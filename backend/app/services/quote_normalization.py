"""
Quote Normalization Engine

The #1 buyer pain point is "comparing apples to oranges" — suppliers quote in different
currencies, units, incoterms, and structures. This engine normalizes all quotes to a
common basis for side-by-side comparison.

Normalization dimensions:
1. Currency → convert all to buyer's base currency using live/cached exchange rates
2. Unit of measure → convert to buyer's requested UoM (e.g., lbs→kg, feet→meters)
3. Incoterms / freight → estimate landed cost from FOB/CIF/EXW differences
4. MOQ penalties → flag when supplier MOQ exceeds buyer quantity
5. Lead time scoring → normalize lead times to a comparable score
"""

import logging
import os
from typing import List, Dict, Any, Optional
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime

logger = logging.getLogger(__name__)


# ---- Exchange Rates (static fallback; override with EXCHANGE_RATE_API_URL env var) ----
# In production, fetch from https://api.exchangerate-api.com/v4/latest/USD or similar
STATIC_EXCHANGE_RATES = {
    "USD": Decimal("1.0"),
    "EUR": Decimal("0.92"),
    "GBP": Decimal("0.79"),
    "CAD": Decimal("1.36"),
    "MXN": Decimal("17.15"),
    "CNY": Decimal("7.24"),
    "JPY": Decimal("149.5"),
    "INR": Decimal("83.1"),
    "KRW": Decimal("1320.0"),
    "BRL": Decimal("4.97"),
    "AUD": Decimal("1.53"),
    "CHF": Decimal("0.88"),
    "SGD": Decimal("1.34"),
    "TWD": Decimal("31.5"),
    "THB": Decimal("35.2"),
}

# ---- Unit Conversion Factors (to SI base units) ----
# Mass → kg, Length → meters, Volume → liters
UNIT_CONVERSIONS = {
    # Mass
    "kg": {"base": "kg", "factor": Decimal("1.0")},
    "lbs": {"base": "kg", "factor": Decimal("0.453592")},
    "lb": {"base": "kg", "factor": Decimal("0.453592")},
    "tons": {"base": "kg", "factor": Decimal("1000.0")},
    "oz": {"base": "kg", "factor": Decimal("0.0283495")},
    "g": {"base": "kg", "factor": Decimal("0.001")},
    # Length
    "meters": {"base": "meters", "factor": Decimal("1.0")},
    "feet": {"base": "meters", "factor": Decimal("0.3048")},
    "ft": {"base": "meters", "factor": Decimal("0.3048")},
    "inches": {"base": "meters", "factor": Decimal("0.0254")},
    "in": {"base": "meters", "factor": Decimal("0.0254")},
    "yards": {"base": "meters", "factor": Decimal("0.9144")},
    "yd": {"base": "meters", "factor": Decimal("0.9144")},
    "mm": {"base": "meters", "factor": Decimal("0.001")},
    "cm": {"base": "meters", "factor": Decimal("0.01")},
    # Volume
    "liters": {"base": "liters", "factor": Decimal("1.0")},
    "gallons": {"base": "liters", "factor": Decimal("3.78541")},
    "gal": {"base": "liters", "factor": Decimal("3.78541")},
    "ml": {"base": "liters", "factor": Decimal("0.001")},
    # Count (no conversion needed)
    "each": {"base": "each", "factor": Decimal("1.0")},
    "pcs": {"base": "each", "factor": Decimal("1.0")},
    "units": {"base": "each", "factor": Decimal("1.0")},
    "sets": {"base": "sets", "factor": Decimal("1.0")},
    "lots": {"base": "lots", "factor": Decimal("1.0")},
    "rolls": {"base": "rolls", "factor": Decimal("1.0")},
    "sheets": {"base": "sheets", "factor": Decimal("1.0")},
    "boxes": {"base": "boxes", "factor": Decimal("1.0")},
    "pallets": {"base": "pallets", "factor": Decimal("1.0")},
}

# ---- Incoterm Freight Adders (approximate % of FOB value) ----
# These are industry-average estimates; buyers can override per-RFQ.
INCOTERM_ADDERS = {
    "EXW": Decimal("0.00"),   # Ex Works — buyer pays everything
    "FCA": Decimal("0.02"),   # Free Carrier
    "FOB": Decimal("0.05"),   # Free On Board (baseline)
    "CFR": Decimal("0.08"),   # Cost and Freight
    "CIF": Decimal("0.10"),   # Cost, Insurance, Freight
    "DAP": Decimal("0.12"),   # Delivered At Place
    "DDP": Decimal("0.15"),   # Delivered Duty Paid (supplier pays everything)
}


class QuoteNormalizationEngine:
    """
    Normalizes supplier quotes to a common basis for apples-to-apples comparison.
    
    This is the platform's highest-WTP feature. Buyers currently spend hours
    manually re-calculating quotes in spreadsheets to compare them fairly.
    """

    def __init__(self):
        self.exchange_rates = dict(STATIC_EXCHANGE_RATES)
        self.last_rate_update: Optional[datetime] = None

    def normalize_quotes(
        self,
        buyer_currency: str,
        buyer_uom: str,
        buyer_quantity: Optional[Decimal],
        buyer_incoterm: str,
        quotes: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Normalize a list of supplier quotes to buyer's terms.

        Each quote dict should have:
            - supplier_id: str
            - supplier_name: str
            - unit_price: float/Decimal (in supplier's currency)
            - currency: str (ISO 4217)
            - unit_of_measure: str
            - quantity_offered: float/Decimal (optional)
            - moq: float/Decimal (optional)
            - lead_time_days: int (optional)
            - incoterm: str (optional, defaults to FOB)

        Returns:
            {
                "base_currency": "USD",
                "base_uom": "kg",
                "base_incoterm": "FOB",
                "normalized_quotes": [...],
                "ranking": [...],
                "warnings": [...]
            }
        """
        normalized = []
        warnings = []
        buyer_currency = buyer_currency.upper()
        buyer_incoterm = buyer_incoterm.upper() if buyer_incoterm else "FOB"

        for quote in quotes:
            try:
                result = self._normalize_single_quote(
                    quote=quote,
                    target_currency=buyer_currency,
                    target_uom=buyer_uom,
                    target_incoterm=buyer_incoterm,
                    buyer_quantity=buyer_quantity,
                )
                normalized.append(result)
            except Exception as e:
                supplier = quote.get("supplier_name", quote.get("supplier_id", "Unknown"))
                warnings.append(f"Could not normalize quote from {supplier}: {str(e)}")
                # Still include the quote with original values
                normalized.append({
                    **quote,
                    "normalized_unit_price": None,
                    "normalized_total": None,
                    "normalization_error": str(e),
                })

        # Rank by normalized unit price (lowest first)
        ranked = sorted(
            [q for q in normalized if q.get("normalized_unit_price") is not None],
            key=lambda q: q["normalized_unit_price"],
        )
        for i, q in enumerate(ranked, 1):
            q["rank"] = i

        # Calculate savings potential
        if len(ranked) >= 2:
            best = ranked[0]["normalized_unit_price"]
            worst = ranked[-1]["normalized_unit_price"]
            if worst > 0:
                savings_pct = float(round((worst - best) / worst * 100, 1))
                warnings.insert(0, f"💡 Potential savings: {savings_pct}% between lowest and highest quote.")

        return {
            "base_currency": buyer_currency,
            "base_uom": buyer_uom,
            "base_incoterm": buyer_incoterm,
            "normalized_quotes": normalized,
            "ranking": [
                {"rank": q["rank"], "supplier_id": q.get("supplier_id"), "supplier_name": q.get("supplier_name"),
                 "normalized_unit_price": float(q["normalized_unit_price"])}
                for q in ranked
            ],
            "warnings": warnings,
        }

    def _normalize_single_quote(
        self,
        quote: Dict[str, Any],
        target_currency: str,
        target_uom: str,
        target_incoterm: str,
        buyer_quantity: Optional[Decimal],
    ) -> Dict[str, Any]:
        """Normalize a single supplier quote."""
        original_price = Decimal(str(quote.get("unit_price", 0)))
        source_currency = quote.get("currency", "USD").upper()
        source_uom = quote.get("unit_of_measure", target_uom).lower()
        source_incoterm = quote.get("incoterm", "FOB").upper()

        # Step 1: Currency conversion
        price_in_target = self._convert_currency(original_price, source_currency, target_currency)

        # Step 2: Unit of measure conversion
        price_in_target_uom = self._convert_uom(price_in_target, source_uom, target_uom.lower())

        # Step 3: Incoterm / freight adjustment
        price_landed = self._adjust_incoterm(price_in_target_uom, source_incoterm, target_incoterm)

        # Step 4: Calculate total
        quantity = buyer_quantity or Decimal(str(quote.get("quantity_offered", 1)))
        total = (price_landed * quantity).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        # Step 5: MOQ check
        moq = quote.get("moq")
        moq_warning = None
        if moq and buyer_quantity and Decimal(str(moq)) > buyer_quantity:
            moq_warning = f"MOQ ({moq}) exceeds your requested quantity ({buyer_quantity})"

        # Step 6: Lead time score (0-100, lower is better)
        lead_time = quote.get("lead_time_days")
        lead_time_score = self._score_lead_time(lead_time)

        return {
            **quote,
            "normalized_unit_price": float(price_landed.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)),
            "normalized_total": float(total),
            "currency_converted": source_currency != target_currency,
            "uom_converted": source_uom != target_uom.lower(),
            "incoterm_adjusted": source_incoterm != target_incoterm,
            "exchange_rate_used": float(self._get_rate(source_currency, target_currency)),
            "lead_time_score": lead_time_score,
            "moq_warning": moq_warning,
            "normalization_details": {
                "original": {"price": float(original_price), "currency": source_currency, "uom": source_uom, "incoterm": source_incoterm},
                "normalized": {"price": float(price_landed), "currency": target_currency, "uom": target_uom, "incoterm": target_incoterm},
            },
        }

    def _convert_currency(self, amount: Decimal, from_currency: str, to_currency: str) -> Decimal:
        """Convert amount between currencies."""
        if from_currency == to_currency:
            return amount
        rate = self._get_rate(from_currency, to_currency)
        return amount * rate

    def _get_rate(self, from_currency: str, to_currency: str) -> Decimal:
        """Get exchange rate between two currencies."""
        if from_currency == to_currency:
            return Decimal("1.0")
        from_usd = self.exchange_rates.get(from_currency)
        to_usd = self.exchange_rates.get(to_currency)
        if from_usd is None:
            raise ValueError(f"Unsupported currency: {from_currency}")
        if to_usd is None:
            raise ValueError(f"Unsupported currency: {to_currency}")
        # Convert: amount_in_from * (1/from_rate) * to_rate = amount_in_to
        return (to_usd / from_usd).quantize(Decimal("0.000001"))

    def _convert_uom(self, price_per_unit: Decimal, from_uom: str, to_uom: str) -> Decimal:
        """Convert price from one unit of measure to another."""
        if from_uom == to_uom:
            return price_per_unit
        from_conv = UNIT_CONVERSIONS.get(from_uom)
        to_conv = UNIT_CONVERSIONS.get(to_uom)
        if not from_conv or not to_conv:
            return price_per_unit  # Can't convert, return as-is
        if from_conv["base"] != to_conv["base"]:
            return price_per_unit  # Incompatible units (e.g., kg vs meters)
        # price_per_from_unit * (from_factor / to_factor) = price_per_to_unit
        conversion_factor = from_conv["factor"] / to_conv["factor"]
        return price_per_unit / conversion_factor

    def _adjust_incoterm(self, price: Decimal, from_incoterm: str, to_incoterm: str) -> Decimal:
        """Adjust price for different incoterms (approximate freight normalization)."""
        if from_incoterm == to_incoterm:
            return price
        from_adder = INCOTERM_ADDERS.get(from_incoterm, Decimal("0.05"))
        to_adder = INCOTERM_ADDERS.get(to_incoterm, Decimal("0.05"))
        # Normalize to EXW base, then add target incoterm costs
        exw_price = price / (Decimal("1.0") + from_adder)
        return exw_price * (Decimal("1.0") + to_adder)

    def _score_lead_time(self, lead_time_days: Optional[int]) -> Optional[int]:
        """Score lead time on 0-100 scale (100 = best/fastest)."""
        if lead_time_days is None:
            return None
        if lead_time_days <= 7:
            return 100
        elif lead_time_days <= 14:
            return 85
        elif lead_time_days <= 30:
            return 70
        elif lead_time_days <= 60:
            return 50
        elif lead_time_days <= 90:
            return 30
        else:
            return 10


# Module-level singleton
quote_normalizer = QuoteNormalizationEngine()
