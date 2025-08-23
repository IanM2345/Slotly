// apps/backend/src/app/api/maps/autocomplete/route.js
import { NextResponse } from "next/server";
import * as Sentry from '@sentry/nextjs';

const KEY = process.env.GOOGLE_PLACES_API_KEY;
const CORS = {
  "Access-Control-Allow-Origin": "*",               // tighten for prod
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() { 
  return new Response(null, { status: 204, headers: CORS }); 
}

export async function GET(req) {
  try {
    if (!KEY) {
      return NextResponse.json({ error: "Server key missing" }, { status: 500, headers: CORS });
    }

    const { searchParams } = new URL(req.url);
    const input = searchParams.get("q") || "";
    const sessiontoken = searchParams.get("sessiontoken") || "";
    const language = searchParams.get("language") || "en";
    const components = searchParams.get("components") || "country:KE"; // optional focus
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const types = searchParams.get("types"); // e.g. "establishment"

    if (!input.trim()) {
      return NextResponse.json({ predictions: [] }, { status: 200, headers: CORS });
    }

    const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
    url.searchParams.set("input", input.trim());
    url.searchParams.set("key", KEY);
    url.searchParams.set("language", language);
    
    if (components) url.searchParams.set("components", components);
    if (sessiontoken) url.searchParams.set("sessiontoken", sessiontoken);
    if (types) url.searchParams.set("types", types); // allow toggling business-only results
    
    // Add location bias if coordinates provided
    if (lat && lng) {
      url.searchParams.set("location", `${lat},${lng}`);
      url.searchParams.set("radius", "50000"); // 50km radius
    }

    const response = await fetch(url.toString());
    const json = await response.json();

    if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
      const errorMessage = json.error_message || json.status;
      console.error("Places API Error:", errorMessage);
      
      Sentry.captureException(new Error(`Places Autocomplete API Error: ${errorMessage}`), {
        tags: {
          service: 'google_places',
          endpoint: 'autocomplete'
        },
        extra: {
          input,
          status: json.status,
          error_message: json.error_message,
          sessiontoken: sessiontoken ? 'present' : 'none',
          location_bias: lat && lng ? `${lat},${lng}` : 'none'
        }
      });
      
      return NextResponse.json({ 
        error: errorMessage 
      }, { status: 502, headers: CORS });
    }

    return NextResponse.json({ 
      predictions: json.predictions || [] 
    }, { status: 200, headers: CORS });

  } catch (error) {
    console.error("Places Autocomplete failed:", error);
    
    Sentry.captureException(error, {
      tags: {
        service: 'google_places',
        endpoint: 'autocomplete'
      },
      extra: {
        url: req.url,
        method: 'GET'
      }
    });
    
    return NextResponse.json({ 
      error: "Places Autocomplete failed" 
    }, { status: 500, headers: CORS });
  }
}