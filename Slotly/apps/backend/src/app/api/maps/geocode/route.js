// apps/backend/src/app/api/maps/geocode/route.js
import { NextResponse } from "next/server";
import * as Sentry from '@sentry/nextjs';

const KEY = process.env.GOOGLE_PLACES_API_KEY;
const CORS = {
  "Access-Control-Allow-Origin": "*",
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

    const searchParams = new URL(req.url).searchParams;
    const address = searchParams.get("address");
    const latlng = searchParams.get("latlng");
    const place_id = searchParams.get("place_id");
    const language = searchParams.get("language") || "en";
    const region = searchParams.get("region") || "ke"; // Kenya bias

    if (!address && !latlng && !place_id) {
      return NextResponse.json({ 
        error: "address or latlng or place_id is required" 
      }, { status: 400, headers: CORS });
    }

    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("key", KEY);
    url.searchParams.set("language", language);
    url.searchParams.set("region", region);
    
    if (address) {
      url.searchParams.set("address", address.trim());
    }
    if (latlng) {
      url.searchParams.set("latlng", latlng);
    }
    if (place_id) {
      url.searchParams.set("place_id", place_id);
    }

    const response = await fetch(url.toString());
    const json = await response.json();
    
    if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
      const errorMessage = json.error_message || json.status;
      console.error("Geocoding API Error:", errorMessage);
      
      Sentry.captureException(new Error(`Geocoding API Error: ${errorMessage}`), {
        tags: {
          service: 'google_maps',
          endpoint: 'geocode'
        },
        extra: {
          address: address || null,
          latlng: latlng || null,
          place_id: place_id || null,
          status: json.status,
          error_message: json.error_message,
          language,
          region
        }
      });
      
      return NextResponse.json({ 
        error: errorMessage 
      }, { status: 502, headers: CORS });
    }

    const firstResult = json.results?.[0];
    return NextResponse.json({
      address: firstResult?.formatted_address || null,
      location: firstResult?.geometry?.location || null,
      components: firstResult?.address_components || null,
      types: firstResult?.types || null,
      raw: json.results || [],
    }, { status: 200, headers: CORS });

  } catch (error) {
    console.error("Geocoding failed:", error);
    
    Sentry.captureException(error, {
      tags: {
        service: 'google_maps',
        endpoint: 'geocode'
      },
      extra: {
        url: req.url,
        method: 'GET'
      }
    });
    
    return NextResponse.json({ 
      error: "Geocoding failed" 
    }, { status: 500, headers: CORS });
  }
}