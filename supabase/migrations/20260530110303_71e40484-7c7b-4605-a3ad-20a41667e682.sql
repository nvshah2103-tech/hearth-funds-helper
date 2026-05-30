
-- Helper: compute current bank balance from opening + master_transactions
CREATE OR REPLACE FUNCTION public._bank_balance(p_user_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(ba.opening_balance), 0)
       + COALESCE((SELECT SUM(credit - debit) FROM master_transactions WHERE user_id = p_user_id), 0)
  FROM bank_accounts ba WHERE ba.user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(
  p_user_id uuid, p_fy_start date, p_fy_end date
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bank numeric; v_inv numeric; v_nw numeric;
  v_month_start date := date_trunc('month', current_date)::date;
  v_month_end date := (date_trunc('month', current_date) + interval '1 month')::date;
  v_income numeric; v_deployed numeric;
  v_tds_sal numeric; v_tds_fd numeric; v_tds_biz numeric;
  v_inv_count int;
  v_next record;
BEGIN
  v_bank := _bank_balance(p_user_id);
  SELECT COALESCE(SUM(amount), 0) INTO v_inv
    FROM investments WHERE user_id = p_user_id AND status = 'Active';
  v_nw := v_bank + v_inv;

  SELECT COALESCE(SUM(net_amount), 0) INTO v_income
    FROM incomes WHERE user_id = p_user_id AND date >= v_month_start AND date < v_month_end;

  SELECT COALESCE((SELECT SUM(amount) FROM investments WHERE user_id = p_user_id AND date >= v_month_start AND date < v_month_end), 0)
       + COALESCE((SELECT SUM(payment_amount) FROM credit_card_bills WHERE user_id = p_user_id AND payment_date >= v_month_start AND payment_date < v_month_end), 0)
       + COALESCE((SELECT SUM(amount) FROM emi_payments WHERE user_id = p_user_id AND paid_date >= v_month_start AND paid_date < v_month_end), 0)
  INTO v_deployed;

  SELECT COALESCE(SUM(tds), 0) INTO v_tds_sal
    FROM incomes WHERE user_id = p_user_id AND income_type = 'Salary' AND date BETWEEN p_fy_start AND p_fy_end;
  SELECT COALESCE(SUM(tds), 0) INTO v_tds_fd
    FROM incomes WHERE user_id = p_user_id AND income_type IN ('FD Maturity','Interest','FD Interest') AND date BETWEEN p_fy_start AND p_fy_end;
  SELECT COALESCE(SUM(tds), 0) INTO v_tds_biz
    FROM business_incomes WHERE user_id = p_user_id AND date BETWEEN p_fy_start AND p_fy_end;

  SELECT COUNT(*) INTO v_inv_count FROM investments WHERE user_id = p_user_id AND status = 'Active';

  SELECT investment_type AS name, maturity_date, COALESCE(expected_maturity_amount, amount) AS amt
  INTO v_next FROM investments
  WHERE user_id = p_user_id AND status = 'Active' AND maturity_date > current_date
  ORDER BY maturity_date ASC LIMIT 1;

  RETURN jsonb_build_object(
    'total_bank_balance', v_bank,
    'total_active_investments', v_inv,
    'net_worth', v_nw,
    'net_worth_last_month', v_nw,
    'net_worth_change', 0,
    'net_worth_change_pct', 0,
    'current_month_income', v_income,
    'current_month_deployed', v_deployed,
    'current_month_surplus', v_income - v_deployed,
    'fy_tds_salary', v_tds_sal,
    'fy_tds_fd', v_tds_fd,
    'fy_tds_business', v_tds_biz,
    'fy_tds_total', v_tds_sal + v_tds_fd + v_tds_biz,
    'active_investment_count', v_inv_count,
    'next_maturity_name', v_next.name,
    'next_maturity_date', v_next.maturity_date,
    'next_maturity_amount', v_next.amt
  );
END $$;

CREATE OR REPLACE FUNCTION public.get_monthly_cashflow(p_user_id uuid, p_months int)
RETURNS TABLE(month_label text, month_date date, total_income numeric, total_deployed numeric, net_surplus numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', current_date) - ((p_months - 1) || ' months')::interval,
      date_trunc('month', current_date),
      '1 month'::interval
    )::date AS m
  )
  SELECT to_char(m, 'Mon') AS month_label, m AS month_date,
    COALESCE((SELECT SUM(net_amount) FROM incomes WHERE user_id = p_user_id AND date >= m AND date < m + interval '1 month'), 0) AS total_income,
    COALESCE((SELECT SUM(amount) FROM investments WHERE user_id = p_user_id AND date >= m AND date < m + interval '1 month'), 0)
    + COALESCE((SELECT SUM(payment_amount) FROM credit_card_bills WHERE user_id = p_user_id AND payment_date >= m AND payment_date < m + interval '1 month'), 0)
    + COALESCE((SELECT SUM(amount) FROM emi_payments WHERE user_id = p_user_id AND paid_date >= m AND paid_date < m + interval '1 month'), 0)
    AS total_deployed,
    0::numeric AS net_surplus
  FROM months ORDER BY m;
$$;

CREATE OR REPLACE FUNCTION public.get_investment_allocation(p_user_id uuid)
RETURNS TABLE(investment_type text, total_amount numeric, percentage_of_total numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH agg AS (
    SELECT investment_type, SUM(amount) AS total
    FROM investments WHERE user_id = p_user_id AND status = 'Active'
    GROUP BY investment_type
  ), total AS (SELECT COALESCE(SUM(total), 0) AS t FROM agg)
  SELECT a.investment_type, a.total,
    CASE WHEN t.t > 0 THEN ROUND((a.total / t.t) * 100, 2) ELSE 0 END
  FROM agg a, total t ORDER BY a.total DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_net_worth_timeline(p_user_id uuid)
RETURNS TABLE(month_date date, bank_total numeric, investment_total numeric, net_worth_total numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH bounds AS (
    SELECT LEAST(
      (SELECT MIN(txn_date) FROM master_transactions WHERE user_id = p_user_id),
      (SELECT MIN(date) FROM investments WHERE user_id = p_user_id),
      (SELECT MIN(date) FROM incomes WHERE user_id = p_user_id)
    ) AS start_date
  ), months AS (
    SELECT generate_series(date_trunc('month', COALESCE((SELECT start_date FROM bounds), current_date)), date_trunc('month', current_date), '1 month')::date AS m
  ), opening AS (SELECT COALESCE(SUM(opening_balance), 0) AS ob FROM bank_accounts WHERE user_id = p_user_id)
  SELECT m AS month_date,
    (SELECT ob FROM opening) + COALESCE((SELECT SUM(credit - debit) FROM master_transactions WHERE user_id = p_user_id AND txn_date < m + interval '1 month'), 0) AS bank_total,
    COALESCE((SELECT SUM(amount) FROM investments WHERE user_id = p_user_id AND status = 'Active' AND date < m + interval '1 month'), 0) AS investment_total,
    0::numeric AS net_worth_total
  FROM months ORDER BY m;
$$;

CREATE OR REPLACE FUNCTION public.get_upcoming_events(p_user_id uuid, p_days_ahead int)
RETURNS TABLE(event_type text, event_name text, event_date date, amount numeric, days_until int, is_overdue boolean, urgency text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ev AS (
    SELECT 'fd_maturity' AS et, investment_type AS en, maturity_date AS ed, COALESCE(expected_maturity_amount, amount) AS am
    FROM investments WHERE user_id = p_user_id AND status = 'Active' AND maturity_date IS NOT NULL
      AND maturity_date <= current_date + (p_days_ahead || ' days')::interval
    UNION ALL
    SELECT 'emi_due', e.name, (date_trunc('month', current_date) + ((e.due_day - 1) || ' days')::interval)::date, e.emi_amount
    FROM emis e WHERE e.user_id = p_user_id AND e.status = 'Active'
  )
  SELECT et, en, ed, am,
    (ed - current_date)::int AS days_until,
    (ed < current_date) AS is_overdue,
    CASE
      WHEN (ed - current_date) <= 3 THEN 'red'
      WHEN (ed - current_date) <= 7 THEN 'amber'
      ELSE 'grey'
    END
  FROM ev ORDER BY ed ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_member_summaries(p_user_id uuid, p_fy_start date, p_fy_end date)
RETURNS TABLE(member_id uuid, member_name text, member_type text, total_income_fy numeric, total_invested_fy numeric, total_bank_balance numeric, total_tds_fy numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.name, CASE WHEN m.is_business THEN 'business' ELSE 'individual' END,
    COALESCE((SELECT SUM(net_amount) FROM incomes WHERE user_id = p_user_id AND member_id = m.id AND date BETWEEN p_fy_start AND p_fy_end), 0),
    COALESCE((SELECT SUM(amount) FROM investments WHERE user_id = p_user_id AND member_id = m.id AND date BETWEEN p_fy_start AND p_fy_end), 0),
    0::numeric,
    COALESCE((SELECT SUM(tds) FROM incomes WHERE user_id = p_user_id AND member_id = m.id AND date BETWEEN p_fy_start AND p_fy_end), 0)
    + COALESCE((SELECT SUM(tds) FROM business_incomes WHERE user_id = p_user_id AND member_id = m.id AND date BETWEEN p_fy_start AND p_fy_end), 0)
  FROM members m WHERE m.user_id = p_user_id ORDER BY m.created_at;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_monthly_cashflow(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_investment_allocation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_net_worth_timeline(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_upcoming_events(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_summaries(uuid, date, date) TO authenticated;
