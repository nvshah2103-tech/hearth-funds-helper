# Project decisions

- Use a single reusable `BrandMark` for product identity so navigation and loading states never drift.
- Keep bank-statement parsing conservative: ambiguous debit/credit rows must be flagged, never silently guessed.
- Build financial charts from semantic CSS chart tokens so visualizations remain consistent and theme-safe.