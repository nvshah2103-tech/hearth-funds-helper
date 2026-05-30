
REVOKE EXECUTE ON FUNCTION public.get_dashboard_kpis(uuid, date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_monthly_cashflow(uuid, int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_investment_allocation(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_net_worth_timeline(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_upcoming_events(uuid, int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_member_summaries(uuid, date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public._bank_balance(uuid) FROM PUBLIC, anon;

-- Add auth.uid() guard to every dashboard function
CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(p_user_id uuid, p_fy_start date, p_fy_end date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bank numeric; v_inv numeric; v_nw numeric;
  v_month_start date := date_trunc('month', current_date)::date;
  v_month_end date := (date_trunc('month', current_date) + interval '1 month')::date;
  v_income numeric; v_deployed numeric;
  v_tds_sal numeric; v_tds_fd numeric; v_tds_biz numeric;
  v_inv_count int; v_next record;
BEGIN
  IF p_user_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_bank := _bank_balance(p_user_id);
  SELECT COALESCE(SUM(amount), 0) INTO v_inv FROM investments WHERE user_id = p_user_id AND status = 'Active';
  v_nw := v_bank + v_inv;
  SELECT COALESCE(SUM(net_amount), 0) INTO v_income FROM incomes WHERE user_id = p_user_id AND date >= v_month_start AND date < v_month_end;
  SELECT COALESCE((SELECT SUM(amount) FROM investments WHERE user_id = p_user_id AND date >= v_month_start AND date < v_month_end), 0)
       + COALESCE((SELECT SUM(payment_amount) FROM credit_card_bills WHERE user_id = p_user_id AND payment_date >= v_month_start AND payment_date < v_month_end), 0)
       + COALESCE((SELECT SUM(amount) FROM emi_payments WHERE user_id = p_user_id AND paid_date >= v_month_start AND paid_date < v_month_end), 0)
    INTO v_deployed;
  SELECT COALESCE(SUM(tds), 0) INTO v_tds_sal FROM incomes WHERE user_id = p_user_id AND income_type = 'Salary' AND date BETWEEN p_fy_start AND p_fy_end;
  SELECT COALESCE(SUM(tds), 0) INTO v_tds_fd FROM incomes WHERE user_id = p_user_id AND income_type IN ('FD Maturity','Interest','FD Interest') AND date BETWEEN p_fy_start AND p_fy_end;
  SELECT COALESCE(SUM(tds), 0) INTO v_tds_biz FROM business_incomes WHERE user_id = p_user_id AND date BETWEEN p_fy_start AND p_fy_end;
  SELECT COUNT(*) INTO v_inv_count FROM investments WHERE user_id = p_user_id AND status = 'Active';
  SELECT investment_type AS name, maturity_date, COALESCE(expected_maturity_amount, amount) AS amt
    INTO v_next FROM investments
    WHERE user_id = p_user_id AND status = 'Active' AND maturity_date > current_date
    ORDER BY maturity_date ASC LIMIT 1;
  RETURN jsonb_build_object(
    'total_bank_balance', v_bank, 'total_active_investments', v_inv, 'net_worth', v_nw,
    'net_worth_last_month', v_nw, 'net_worth_change', 0, 'net_worth_change_pct', 0,
    'current_month_income', v_income, 'current_month_deployed', v_deployed,
    'current_month_surplus', v_income - v_deployed,
    'fy_tds_salary', v_tds_sal, 'fy_tds_fd', v_tds_fd, 'fy_tds_business', v_tds_biz,
    'fy_tds_total', v_tds_sal + v_tds_fd + v_tds_biz,
    'active_investment_count', v_inv_count,
    'next_maturity_name', v_next.name, 'next_maturity_date', v_next.maturity_date, 'next_maturity_amount', v_next.amt
  );
END $$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_monthly_cashflow(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_investment_allocation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_net_worth_timeline(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_upcoming_events(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_summaries(uuid, date, date) TO authenticated;
