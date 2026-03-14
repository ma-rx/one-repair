// Mirror of Django TextChoices — keep in sync with apps/core/models.py

export const SymptomCode = {
  NO_POWER: "NO_POWER",
  WONT_START: "WONT_START",
  OVERHEATING: "OVERHEATING",
  UNUSUAL_NOISE: "UNUSUAL_NOISE",
  LEAKING: "LEAKING",
  NOT_COOLING: "NOT_COOLING",
  NOT_HEATING: "NOT_HEATING",
  DISPLAY_ISSUE: "DISPLAY_ISSUE",
  ERROR_CODE_DISPLAYED: "ERROR_CODE_DISPLAYED",
  CONNECTIVITY_ISSUE: "CONNECTIVITY_ISSUE",
  PHYSICAL_DAMAGE: "PHYSICAL_DAMAGE",
  SLOW_PERFORMANCE: "SLOW_PERFORMANCE",
  OTHER: "OTHER",
} as const;

export const SymptomCodeLabels: Record<string, string> = {
  NO_POWER: "No Power",
  WONT_START: "Won't Start",
  OVERHEATING: "Overheating",
  UNUSUAL_NOISE: "Unusual Noise",
  LEAKING: "Leaking",
  NOT_COOLING: "Not Cooling",
  NOT_HEATING: "Not Heating",
  DISPLAY_ISSUE: "Display Issue",
  ERROR_CODE_DISPLAYED: "Error Code Displayed",
  CONNECTIVITY_ISSUE: "Connectivity Issue",
  PHYSICAL_DAMAGE: "Physical Damage",
  SLOW_PERFORMANCE: "Slow Performance",
  OTHER: "Other",
};

export const ResolutionCode = {
  REPLACED_PART: "REPLACED_PART",
  REPAIRED_IN_FIELD: "REPAIRED_IN_FIELD",
  ADJUSTED_SETTINGS: "ADJUSTED_SETTINGS",
  FIRMWARE_UPDATE: "FIRMWARE_UPDATE",
  CLEANED_SERVICED: "CLEANED_SERVICED",
  REPROGRAMMED: "REPROGRAMMED",
  PREVENTIVE_MAINTENANCE: "PREVENTIVE_MAINTENANCE",
  AWAITING_PARTS: "AWAITING_PARTS",
  REFERRED_TO_VENDOR: "REFERRED_TO_VENDOR",
  NO_FAULT_FOUND: "NO_FAULT_FOUND",
  OTHER: "OTHER",
} as const;

export const ResolutionCodeLabels: Record<string, string> = {
  REPLACED_PART: "Replaced Part",
  REPAIRED_IN_FIELD: "Repaired in Field",
  ADJUSTED_SETTINGS: "Adjusted Settings",
  FIRMWARE_UPDATE: "Firmware Update",
  CLEANED_SERVICED: "Cleaned / Serviced",
  REPROGRAMMED: "Reprogrammed",
  PREVENTIVE_MAINTENANCE: "Preventive Maintenance",
  AWAITING_PARTS: "Awaiting Parts",
  REFERRED_TO_VENDOR: "Referred to Vendor",
  NO_FAULT_FOUND: "No Fault Found",
  OTHER: "Other",
};

export const TicketStatus = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  PENDING_PARTS: "PENDING_PARTS",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
  CANCELLED: "CANCELLED",
} as const;

export const AssetCategory = {
  HVAC:              "HVAC",
  REFRIGERATION:     "REFRIGERATION",
  COOKING_EQUIPMENT: "COOKING_EQUIPMENT",
  ICE_MACHINE:       "ICE_MACHINE",
  DISHWASHER:        "DISHWASHER",
  POS_SYSTEM:        "POS_SYSTEM",
  LIGHTING:          "LIGHTING",
  PLUMBING:          "PLUMBING",
  ELECTRICAL:        "ELECTRICAL",
  ELEVATOR:          "ELEVATOR",
  COFFEE_EQUIPMENT:  "COFFEE_EQUIPMENT",
  ESPRESSO_MACHINE:  "ESPRESSO_MACHINE",
  OTHER:             "OTHER",
} as const;

export const AssetCategoryLabels: Record<string, string> = {
  HVAC:              "HVAC",
  REFRIGERATION:     "Refrigeration",
  COOKING_EQUIPMENT: "Cooking Equipment",
  ICE_MACHINE:       "Ice Machine",
  DISHWASHER:        "Dishwasher",
  POS_SYSTEM:        "POS System",
  LIGHTING:          "Lighting",
  PLUMBING:          "Plumbing",
  ELECTRICAL:        "Electrical",
  ELEVATOR:          "Elevator",
  COFFEE_EQUIPMENT:  "Coffee Equipment",
  ESPRESSO_MACHINE:  "Espresso Machine",
  OTHER:             "Other",
};

export const AssetStatus = {
  OPERATIONAL:       "OPERATIONAL",
  UNDER_MAINTENANCE: "UNDER_MAINTENANCE",
  OUT_OF_SERVICE:    "OUT_OF_SERVICE",
  DECOMMISSIONED:    "DECOMMISSIONED",
} as const;

export const AssetStatusLabels: Record<string, string> = {
  OPERATIONAL:       "Operational",
  UNDER_MAINTENANCE: "Under Maintenance",
  OUT_OF_SERVICE:    "Out of Service",
  DECOMMISSIONED:    "Decommissioned",
};

export const PartRequestUrgency = {
  ASAP:       "ASAP",
  NEXT_VISIT: "NEXT_VISIT",
} as const;

export const PartRequestUrgencyLabels: Record<string, string> = {
  ASAP:       "ASAP",
  NEXT_VISIT: "Next Visit",
};

export const PartRequestStatus = {
  PENDING:         "PENDING",
  APPROVED_ORS:    "APPROVED_ORS",
  SENT_TO_CLIENT:  "SENT_TO_CLIENT",
  APPROVED_CLIENT: "APPROVED_CLIENT",
  DENIED:          "DENIED",
  ORDERED:         "ORDERED",
  DELIVERED:       "DELIVERED",
} as const;

export const PartRequestStatusLabels: Record<string, string> = {
  PENDING:         "Pending ORS Review",
  APPROVED_ORS:    "Approved by ORS",
  SENT_TO_CLIENT:  "Sent to Client",
  APPROVED_CLIENT: "Approved by Client",
  DENIED:          "Denied",
  ORDERED:         "Ordered",
  DELIVERED:       "Delivered",
};
