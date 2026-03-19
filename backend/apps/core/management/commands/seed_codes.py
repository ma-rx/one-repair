from django.core.management.base import BaseCommand
from apps.core.models import SymptomCodeEntry, ResolutionCodeEntry

SYMPTOM_CODES = [
    ("NO_POWER", "No Power"),
    ("WONT_START", "Won't Start"),
    ("OVERHEATING", "Overheating"),
    ("TEMPERATURE_INCONSISTENT", "Temperature Inconsistent"),
    ("UNUSUAL_NOISE", "Unusual Noise"),
    ("LEAKING", "Leaking"),
    ("NOT_COOLING", "Not Cooling"),
    ("NOT_HEATING", "Not Heating"),
    ("NOT_DISPENSING", "Not Dispensing"),
    ("ICE_BUILDUP", "Ice Buildup / Frost"),
    ("COMPRESSOR_ISSUE", "Compressor Issue"),
    ("FILTER_CLOG", "Filter / Clog"),
    ("PUMP_FAILURE", "Pump Failure"),
    ("DOOR_SEAL_ISSUE", "Door / Seal Issue"),
    ("IGNITER_ISSUE", "Igniter Issue"),
    ("PILOT_LIGHT_OUT", "Pilot Light Out"),
    ("DISPLAY_ISSUE", "Display Issue"),
    ("ERROR_CODE_DISPLAYED", "Error Code Displayed"),
    ("CONNECTIVITY_ISSUE", "Connectivity Issue"),
    ("PHYSICAL_DAMAGE", "Physical Damage"),
    ("SLOW_PERFORMANCE", "Slow Performance"),
    ("CALIBRATION_NEEDED", "Calibration Needed"),
    ("OTHER", "Other"),
]

RESOLUTION_CODES = [
    ("REPLACED_COMPRESSOR", "Replaced Compressor"),
    ("REPLACED_THERMOSTAT", "Replaced Thermostat"),
    ("REPLACED_PUMP", "Replaced Pump"),
    ("REPLACED_HEATING_ELEMENT", "Replaced Heating Element"),
    ("REPLACED_IGNITER", "Replaced Igniter"),
    ("REPLACED_CONTROL_BOARD", "Replaced Control Board"),
    ("REPLACED_SEAL_GASKET", "Replaced Seal / Gasket"),
    ("REPLACED_FILTER", "Replaced Filter"),
    ("REPLACED_PART", "Replaced Part (Other)"),
    ("REPAIRED_IN_FIELD", "Repaired in Field"),
    ("DESCALED_CLEANED", "Descaled / Deep Cleaned"),
    ("CLEANED_SERVICED", "Cleaned / Serviced"),
    ("ADJUSTED_SETTINGS", "Adjusted Settings"),
    ("CALIBRATED", "Calibrated"),
    ("REPROGRAMMED", "Reprogrammed"),
    ("FIRMWARE_UPDATE", "Firmware Update"),
    ("PREVENTIVE_MAINTENANCE", "Preventive Maintenance"),
    ("TRAINED_STAFF", "Trained Staff / User Error"),
    ("AWAITING_PARTS", "Awaiting Parts"),
    ("REFERRED_TO_VENDOR", "Referred to Vendor"),
    ("NO_FAULT_FOUND", "No Fault Found"),
    ("OTHER", "Other"),
]


class Command(BaseCommand):
    help = "Seed global symptom and resolution codes from existing TextChoices"

    def handle(self, *args, **kwargs):
        for i, (code, label) in enumerate(SYMPTOM_CODES):
            SymptomCodeEntry.objects.get_or_create(
                code=code, make="",
                defaults={"label": label, "sort_order": i}
            )
        self.stdout.write(f"Seeded {len(SYMPTOM_CODES)} symptom codes")

        for i, (code, label) in enumerate(RESOLUTION_CODES):
            ResolutionCodeEntry.objects.get_or_create(
                code=code, make="",
                defaults={"label": label, "sort_order": i}
            )
        self.stdout.write(f"Seeded {len(RESOLUTION_CODES)} resolution codes")
