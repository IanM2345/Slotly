// apps/backend/src/app/api/maps/details/route.js
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

    const place_id = new URL(req.url).searchParams.get("place_id");
    if (!place_id) {
      return NextResponse.json({ 
        error: "place_id is required" 
      }, { status: 400, headers: CORS });
    }

    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.set("place_id", place_id);
    url.searchParams.set("key", KEY);
    url.searchParams.set("fields", "formatted_address,name,geometry,address_components,types,place_id");

    const response = await fetch(url.toString());
    const json = await response.json();
    
    if (json.status !== "OK") {
      const errorMessage = json.error_message || json.status;
      console.error("Place Details API Error:", errorMessage);
      
      Sentry.captureException(new Error(`Place Details API Error: ${errorMessage}`), {
        tags: {
          service: 'google_places',
          endpoint: 'details'
        },
        extra: {
          place_id,
          status: json.status,
          error_message: json.error_message
        }
      });
      
      return NextResponse.json({ 
        error: errorMessage 
      }, { status: 502, headers: CORS });
    }

    const result = json.result || {};
    return NextResponse.json({
      address: result.formatted_address,
      name: result.name,
      components: result.address_components,
      location: result.geometry?.location, // { lat, lng }
      types: result.types,
      place_id: result.place_id,
    }, { status: 200, headers: CORS });

  } catch (error) {
    console.error("Place Details failed:", error);
    
    Sentry.captureException(error, {
      tags: {
        service: 'google_places',
        endpoint: 'details'
      },
      extra: {
        url: req.url,
        method: 'GET'
      }
    });
    
    return NextResponse.json({ 
      error: "Place Details failed" 
    }, { status: 500, headers: CORS });
  }
}