"""
AI RFP Builder Service

Uses LLM to transform unstructured buyer intent into structured RFQ line items.
This is the core product differentiator — it compresses RFP creation from hours to minutes.

Flow:
1. Buyer types free-text description of what they need
2. Service sends to LLM with domain-specific prompt
3. LLM returns structured line items (description, qty, UoM, specs, certifications)
4. Frontend renders as editable line items in the RFP builder stepper
"""

import json
import os
import logging
import httpx
from typing import List, Optional, Dict, Any

logger = logging.getLogger(__name__)

# LLM Configuration — supports OpenAI, Azure OpenAI, or any compatible API
LLM_API_KEY = os.environ.get("OPENAI_API_KEY", "")
LLM_API_URL = os.environ.get("LLM_API_URL", "https://api.openai.com/v1/chat/completions")
LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-4o-mini")

# Domain ontology for procurement
PROCUREMENT_CATEGORIES = [
    "Raw Materials", "Fasteners", "Electronics", "Packaging", "Chemicals",
    "Metals", "Plastics", "Rubber", "Textiles", "Machinery", "Tools",
    "Safety Equipment", "Electrical Components", "Hydraulics", "Bearings",
    "Adhesives", "Coatings", "Castings", "Forgings", "Stampings",
    "Extrusions", "Molded Parts", "Printed Circuit Boards", "Cables & Wiring",
    "Valves & Fittings", "Pumps", "Motors", "Sensors", "Instrumentation",
]

UNITS_OF_MEASURE = [
    "each", "pcs", "kg", "lbs", "meters", "feet", "liters", "gallons",
    "tons", "rolls", "sheets", "boxes", "pallets", "sets", "lots",
]

SYSTEM_PROMPT = """You are an expert procurement assistant for a B2B supply chain sourcing platform.
Your job is to transform a buyer's free-text description of their needs into structured RFQ (Request for Quote) line items.

For each distinct item or service the buyer needs, generate a structured line item with:
- description: Clear, specific description of the item/service
- part_number: Suggested part number or spec reference if identifiable (null if unknown)
- quantity: Numeric quantity needed (estimate if buyer is vague)
- unit_of_measure: One of: each, pcs, kg, lbs, meters, feet, liters, gallons, tons, rolls, sheets, boxes, pallets, sets, lots
- target_unit_price: Estimated market price per unit in USD (null if truly unknown)
- specifications: Technical specifications, dimensions, tolerances, material grade
- required_certifications: List of relevant certifications (ISO 9001, RoHS, ITAR, AS9100, etc.)
- category: Most relevant procurement category

CRITICAL RULES:
1. Break complex requests into individual line items (one per distinct part/material/service)
2. Always specify unit_of_measure — never leave it blank
3. Include material grade/spec when inferable (e.g., "steel" → "AISI 304 Stainless Steel")
4. Suggest certifications based on industry context
5. Return valid JSON array — no markdown, no explanation

Example input: "We need about 5000 stainless steel hex bolts, M8 size, and some flat washers to go with them"
Example output:
[
  {
    "description": "Stainless Steel Hex Head Bolt, M8 x 1.25 Thread, Grade A2-70",
    "part_number": "HHB-M8-SS-A2",
    "quantity": 5000,
    "unit_of_measure": "pcs",
    "target_unit_price": 0.12,
    "specifications": "M8 x 1.25 x 25mm, DIN 933, A2-70 (AISI 304) Stainless Steel, plain finish",
    "required_certifications": ["ISO 9001", "RoHS"],
    "category": "Fasteners"
  },
  {
    "description": "Stainless Steel Flat Washer, M8, A2 Grade",
    "part_number": "FW-M8-SS-A2",
    "quantity": 5000,
    "unit_of_measure": "pcs",
    "target_unit_price": 0.03,
    "specifications": "M8 (8.4mm ID x 16mm OD x 1.6mm thick), DIN 125A, A2 Stainless Steel",
    "required_certifications": ["ISO 9001", "RoHS"],
    "category": "Fasteners"
  }
]"""


class AIRFPBuilderService:
    """
    LLM-powered RFP structuring service.
    
    Transforms free-text buyer intent into structured line items that can be
    directly inserted into an RFQ, eliminating the manual spreadsheet work
    that typically takes 2-4 hours per RFP.
    """

    def __init__(self):
        self.api_key = LLM_API_KEY
        self.api_url = LLM_API_URL
        self.model = LLM_MODEL
        self.categories = PROCUREMENT_CATEGORIES
        self.uom_list = UNITS_OF_MEASURE

    async def generate_line_items(
        self,
        buyer_intent: str,
        category_hint: Optional[str] = None,
        budget_hint: Optional[str] = None,
        additional_context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate structured RFQ line items from free-text buyer description.

        Args:
            buyer_intent: Free-text description of what the buyer needs
            category_hint: Optional category to guide the LLM
            budget_hint: Optional budget range (e.g., "$10,000-$50,000")
            additional_context: Optional extra context (industry, compliance needs, etc.)

        Returns:
            {
                "line_items": [...],
                "suggested_category": "...",
                "confidence": 0.0-1.0,
                "warnings": [...]
            }
        """
        if not self.api_key:
            return self._fallback_parse(buyer_intent)

        # Build the user message with context
        user_message = f"Buyer request: {buyer_intent}"
        if category_hint:
            user_message += f"\nCategory context: {category_hint}"
        if budget_hint:
            user_message += f"\nBudget range: {budget_hint}"
        if additional_context:
            user_message += f"\nAdditional context: {additional_context}"

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.api_url,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": user_message},
                        ],
                        "temperature": 0.2,  # Low temperature for structured output
                        "max_tokens": 2000,
                    },
                )
                response.raise_for_status()
                result = response.json()

            # Extract the LLM response
            content = result["choices"][0]["message"]["content"].strip()

            # Parse JSON from the LLM output
            line_items = self._parse_llm_response(content)

            # Validate and enrich line items
            validated_items = self._validate_line_items(line_items)

            # Determine suggested category from the items
            categories_seen = [item.get("category", "") for item in validated_items if item.get("category")]
            suggested_category = max(set(categories_seen), key=categories_seen.count) if categories_seen else None

            return {
                "line_items": validated_items,
                "suggested_category": suggested_category,
                "confidence": self._calculate_confidence(validated_items),
                "warnings": self._generate_warnings(validated_items, buyer_intent),
            }

        except httpx.HTTPStatusError as e:
            logger.error(f"LLM API error: {e.response.status_code} — {e.response.text}")
            return self._fallback_parse(buyer_intent)
        except Exception as e:
            logger.error(f"AI RFP Builder error: {e}")
            return self._fallback_parse(buyer_intent)

    def _parse_llm_response(self, content: str) -> List[Dict[str, Any]]:
        """Parse JSON array from LLM response, handling markdown code fences."""
        # Strip markdown code fences if present
        if "```" in content:
            parts = content.split("```")
            for part in parts:
                part = part.strip()
                if part.startswith("json"):
                    part = part[4:].strip()
                if part.startswith("["):
                    content = part
                    break

        try:
            parsed = json.loads(content)
            if isinstance(parsed, list):
                return parsed
            if isinstance(parsed, dict) and "line_items" in parsed:
                return parsed["line_items"]
            return [parsed]
        except json.JSONDecodeError:
            logger.warning("Failed to parse LLM response as JSON")
            return []

    def _validate_line_items(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Validate and normalize each line item."""
        validated = []
        for i, item in enumerate(items, 1):
            validated_item = {
                "line_number": i,
                "description": str(item.get("description", "")).strip(),
                "part_number": item.get("part_number"),
                "quantity": self._parse_number(item.get("quantity")),
                "unit_of_measure": self._normalize_uom(item.get("unit_of_measure", "each")),
                "target_unit_price": self._parse_number(item.get("target_unit_price")),
                "specifications": str(item.get("specifications", "")).strip() or None,
                "required_certifications": item.get("required_certifications", []),
                "category": item.get("category"),
            }
            # Skip items with no description
            if validated_item["description"]:
                validated.append(validated_item)
        return validated

    def _normalize_uom(self, uom: str) -> str:
        """Normalize unit of measure to standard values."""
        if not uom:
            return "each"
        uom_lower = uom.lower().strip()
        # Map common aliases
        aliases = {
            "piece": "pcs", "pieces": "pcs", "pc": "pcs", "unit": "each",
            "units": "each", "kilogram": "kg", "kilograms": "kg",
            "pound": "lbs", "pounds": "lbs", "lb": "lbs",
            "meter": "meters", "m": "meters", "foot": "feet", "ft": "feet",
            "liter": "liters", "l": "liters", "gallon": "gallons", "gal": "gallons",
            "ton": "tons", "roll": "rolls", "sheet": "sheets",
            "box": "boxes", "pallet": "pallets", "set": "sets", "lot": "lots",
        }
        return aliases.get(uom_lower, uom_lower)

    def _parse_number(self, value: Any) -> Optional[float]:
        """Safely parse a number from various formats."""
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            # Remove currency symbols and commas
            cleaned = value.replace("$", "").replace(",", "").replace(" ", "").strip()
            try:
                return float(cleaned)
            except ValueError:
                return None
        return None

    def _calculate_confidence(self, items: List[Dict[str, Any]]) -> float:
        """Calculate confidence score based on completeness of parsed items."""
        if not items:
            return 0.0
        scores = []
        for item in items:
            score = 0.0
            if item.get("description"):
                score += 0.3
            if item.get("quantity") is not None:
                score += 0.2
            if item.get("unit_of_measure"):
                score += 0.1
            if item.get("specifications"):
                score += 0.2
            if item.get("target_unit_price") is not None:
                score += 0.1
            if item.get("required_certifications"):
                score += 0.1
            scores.append(score)
        return round(sum(scores) / len(scores), 2)

    def _generate_warnings(self, items: List[Dict[str, Any]], original_text: str) -> List[str]:
        """Generate warnings about potential issues."""
        warnings = []
        if not items:
            warnings.append("Could not parse any line items from the description. Please add items manually.")
        for item in items:
            if item.get("quantity") is None:
                warnings.append(f"No quantity specified for: {item.get('description', 'unknown item')}")
            if item.get("target_unit_price") is None:
                warnings.append(f"No target price estimated for: {item.get('description', 'unknown item')}")
        if len(items) == 1 and len(original_text) > 200:
            warnings.append("Your description is detailed but only one line item was generated. Consider splitting into multiple items.")
        return warnings

    def _fallback_parse(self, buyer_intent: str) -> Dict[str, Any]:
        """Fallback when LLM is unavailable — create a single line item from the text."""
        return {
            "line_items": [
                {
                    "line_number": 1,
                    "description": buyer_intent.strip()[:500],
                    "part_number": None,
                    "quantity": None,
                    "unit_of_measure": "each",
                    "target_unit_price": None,
                    "specifications": None,
                    "required_certifications": [],
                    "category": None,
                }
            ],
            "suggested_category": None,
            "confidence": 0.1,
            "warnings": [
                "AI assistant is currently unavailable. A single line item was created from your description. "
                "Please edit and split into individual items as needed."
            ],
        }


# Module-level singleton
ai_rfp_builder = AIRFPBuilderService()
