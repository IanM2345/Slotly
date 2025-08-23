// apps/backend/src/app/api/maps/directions/route.js (bonus route)
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
    const origin = searchParams.get("origin");
    const destination = searchParams.get("destination");
    const mode = searchParams.get("mode") || "driving";
    const language = searchParams.get("language") || "en";
    const units = searchParams.get("units") || "metric";

    if (!origin || !destination) {
      return NextResponse.json({ 
        error: "origin and destination are required" 
      }, { status: 400, headers: CORS });
    }

    const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
    url.searchParams.set("origin", origin);
    url.searchParams.set("destination", destination);
    url.searchParams.set("mode", mode);
    url.searchParams.set("language", language);
    url.searchParams.set("units", units);
    url.searchParams.set("key", KEY);

    const response = await fetch(url.toString());
    const json = await response.json();
    
    if (json.status !== "OK") {
      const errorMessage = json.error_message || json.status;
      console.error("Directions API Error:", errorMessage);
      
      Sentry.captureException(new Error(`Directions API Error: ${errorMessage}`), {
        tags: {
          service: 'google_maps',
          endpoint: 'directions'
        },
        extra: {
          origin,
          destination,
          mode,
          status: json.status,
          error_message: json.error_message,
          language,
          units
        }
      });
      
      return NextResponse.json({ 
        error: errorMessage 
      }, { status: 502, headers: CORS });
    }

    const route = json.routes?.[0];
    const leg = route?.legs?.[0];

    return NextResponse.json({
      distance: leg?.distance,
      duration: leg?.duration,
      start_address: leg?.start_address,
      end_address: leg?.end_address,
      steps: leg?.steps,
      overview_polyline: route?.overview_polyline,
      raw: json,
    }, { status: 200, headers: CORS });

  } catch (error) {
    console.error("Directions failed:", error);
    
    Sentry.captureException(error, {
      tags: {
        service: 'google_maps',
        endpoint: 'directions'
      },
      extra: {
        url: req.url,
        method: 'GET'
      }
    });
    
    return NextResponse.json({ 
      error: "Directions failed" 
    }, { status: 500, headers: CORS });
  }
}