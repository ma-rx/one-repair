// Mirror of Django TextChoices — keep in sync with apps/core/models.py

export const SymptomCode = {
  NO_POWER:                 "NO_POWER",
  WONT_START:               "WONT_START",
  OVERHEATING:              "OVERHEATING",
  TEMPERATURE_INCONSISTENT: "TEMPERATURE_INCONSISTENT",
  UNUSUAL_NOISE:            "UNUSUAL_NOISE",
  LEAKING:                  "LEAKING",
  NOT_COOLING:              "NOT_COOLING",
  NOT_HEATING:              "NOT_HEATING",
  NOT_DISPENSING:           "NOT_DISPENSING",
  ICE_BUILDUP:              "ICE_BUILDUP",
  COMPRESSOR_ISSUE:         "COMPRESSOR_ISSUE",
  FILTER_CLOG:              "FILTER_CLOG",
  PUMP_FAILURE:             "PUMP_FAILURE",
  DOOR_SEAL_ISSUE:          "DOOR_SEAL_ISSUE",
  IGNITER_ISSUE:            "IGNITER_ISSUE",
  PILOT_LIGHT_OUT:          "PILOT_LIGHT_OUT",
  DISPLAY_ISSUE:            "DISPLAY_ISSUE",
  ERROR_CODE_DISPLAYED:     "ERROR_CODE_DISPLAYED",
  CONNECTIVITY_ISSUE:       "CONNECTIVITY_ISSUE",
  PHYSICAL_DAMAGE:          "PHYSICAL_DAMAGE",
  SLOW_PERFORMANCE:         "SLOW_PERFORMANCE",
  CALIBRATION_NEEDED:       "CALIBRATION_NEEDED",
  OTHER:                    "OTHER",
} as const;

export const SymptomCodeLabels: Record<string, string> = {
  NO_POWER:                 "No Power",
  WONT_START:               "Won't Start",
  OVERHEATING:              "Overheating",
  TEMPERATURE_INCONSISTENT: "Temperature Inconsistent",
  UNUSUAL_NOISE:            "Unusual Noise",
  LEAKING:                  "Leaking",
  NOT_COOLING:              "Not Cooling",
  NOT_HEATING:              "Not Heating",
  NOT_DISPENSING:           "Not Dispensing",
  ICE_BUILDUP:              "Ice Buildup / Frost",
  COMPRESSOR_ISSUE:         "Compressor Issue",
  FILTER_CLOG:              "Filter / Clog",
  PUMP_FAILURE:             "Pump Failure",
  DOOR_SEAL_ISSUE:          "Door / Seal Issue",
  IGNITER_ISSUE:            "Igniter Issue",
  PILOT_LIGHT_OUT:          "Pilot Light Out",
  DISPLAY_ISSUE:            "Display Issue",
  ERROR_CODE_DISPLAYED:     "Error Code Displayed",
  CONNECTIVITY_ISSUE:       "Connectivity Issue",
  PHYSICAL_DAMAGE:          "Physical Damage",
  SLOW_PERFORMANCE:         "Slow Performance",
  CALIBRATION_NEEDED:       "Calibration Needed",
  OTHER:                    "Other",
};

export const ResolutionCode = {
  REPLACED_COMPRESSOR:      "REPLACED_COMPRESSOR",
  REPLACED_THERMOSTAT:      "REPLACED_THERMOSTAT",
  REPLACED_PUMP:            "REPLACED_PUMP",
  REPLACED_HEATING_ELEMENT: "REPLACED_HEATING_ELEMENT",
  REPLACED_IGNITER:         "REPLACED_IGNITER",
  REPLACED_CONTROL_BOARD:   "REPLACED_CONTROL_BOARD",
  REPLACED_SEAL_GASKET:     "REPLACED_SEAL_GASKET",
  REPLACED_FILTER:          "REPLACED_FILTER",
  REPLACED_PART:            "REPLACED_PART",
  REPAIRED_IN_FIELD:        "REPAIRED_IN_FIELD",
  DESCALED_CLEANED:         "DESCALED_CLEANED",
  CLEANED_SERVICED:         "CLEANED_SERVICED",
  ADJUSTED_SETTINGS:        "ADJUSTED_SETTINGS",
  CALIBRATED:               "CALIBRATED",
  REPROGRAMMED:             "REPROGRAMMED",
  FIRMWARE_UPDATE:          "FIRMWARE_UPDATE",
  PREVENTIVE_MAINTENANCE:   "PREVENTIVE_MAINTENANCE",
  TRAINED_STAFF:            "TRAINED_STAFF",
  AWAITING_PARTS:           "AWAITING_PARTS",
  REFERRED_TO_VENDOR:       "REFERRED_TO_VENDOR",
  NO_FAULT_FOUND:           "NO_FAULT_FOUND",
  OTHER:                    "OTHER",
} as const;

export const ResolutionCodeLabels: Record<string, string> = {
  REPLACED_COMPRESSOR:      "Replaced Compressor",
  REPLACED_THERMOSTAT:      "Replaced Thermostat",
  REPLACED_PUMP:            "Replaced Pump",
  REPLACED_HEATING_ELEMENT: "Replaced Heating Element",
  REPLACED_IGNITER:         "Replaced Igniter",
  REPLACED_CONTROL_BOARD:   "Replaced Control Board",
  REPLACED_SEAL_GASKET:     "Replaced Seal / Gasket",
  REPLACED_FILTER:          "Replaced Filter",
  REPLACED_PART:            "Replaced Part (Other)",
  REPAIRED_IN_FIELD:        "Repaired in Field",
  DESCALED_CLEANED:         "Descaled / Deep Cleaned",
  CLEANED_SERVICED:         "Cleaned / Serviced",
  ADJUSTED_SETTINGS:        "Adjusted Settings",
  CALIBRATED:               "Calibrated",
  REPROGRAMMED:             "Reprogrammed",
  FIRMWARE_UPDATE:          "Firmware Update",
  PREVENTIVE_MAINTENANCE:   "Preventive Maintenance",
  TRAINED_STAFF:            "Trained Staff / User Error",
  AWAITING_PARTS:           "Awaiting Parts",
  REFERRED_TO_VENDOR:       "Referred to Vendor",
  NO_FAULT_FOUND:           "No Fault Found",
  OTHER:                    "Other",
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

export const KnowledgeDifficulty = {
  EASY:     "EASY",
  MEDIUM:   "MEDIUM",
  HARD:     "HARD",
  ADVANCED: "ADVANCED",
} as const;

export const KnowledgeDifficultyLabels: Record<string, string> = {
  EASY:     "Easy",
  MEDIUM:   "Medium",
  HARD:     "Hard",
  ADVANCED: "Advanced",
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
