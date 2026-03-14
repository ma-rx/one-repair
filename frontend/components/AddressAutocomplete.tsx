"use client";

import { useEffect, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

export interface AddressParts {
  address_line1: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
}

interface Props {
  value: string;
  onChange: (raw: string) => void;
  onSelect: (parts: AddressParts) => void;
  placeholder?: string;
  required?: boolean;
}

let placesLoaded = false;
let optionsSet   = false;

function ensureOptions() {
  if (optionsSet) return;
  setOptions({
    apiKey:  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    version: "weekly",
  });
  optionsSet = true;
}

export default function AddressAutocomplete({ value, onChange, onSelect, placeholder, required }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const acRef    = useRef<google.maps.places.Autocomplete | null>(null);
  const [ready, setReady] = useState(placesLoaded);

  useEffect(() => {
    if (placesLoaded) { setReady(true); return; }
    ensureOptions();
    importLibrary("places").then(() => {
      placesLoaded = true;
      setReady(true);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!ready || !inputRef.current || acRef.current) return;

    acRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      fields: ["address_components", "formatted_address"],
    });

    acRef.current.addListener("place_changed", () => {
      const place = acRef.current!.getPlace();
      if (!place.address_components) return;

      const get = (type: string, short = false) => {
        const c = place.address_components!.find(c => c.types.includes(type));
        return c ? (short ? c.short_name : c.long_name) : "";
      };

      const streetNumber = get("street_number");
      const route        = get("route");
      const parts: AddressParts = {
        address_line1: [streetNumber, route].filter(Boolean).join(" "),
        city:          get("locality") || get("sublocality") || get("postal_town"),
        state:         get("administrative_area_level_1", true),
        zip_code:      get("postal_code"),
        country:       get("country", true),
      };

      onChange(parts.address_line1);
      onSelect(parts);
    });
  }, [ready]);

  return (
    <input
      ref={inputRef}
      type="text"
      required={required}
      placeholder={placeholder ?? "Start typing an address…"}
      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete="off"
    />
  );
}
