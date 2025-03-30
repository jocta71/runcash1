// This file is automatically generated. Do not edit it directly.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import axios from 'axios';

const SUPABASE_URL = "https://evzqzghxuttctbxgohpx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2enF6Z2h4dXR0Y3RieGdvaHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDExNzc5OTEsImV4cCI6MjA1Njc1Mzk5MX0.CmoM_y0i36nbBx2iN0DlOIob3yAgVRM1xY_XiOFBZLQ";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

type Roulette = {
  id: string;
  uuid?: string;
  nome?: string;
  name?: string;
  roleta_nome?: string;
  vitorias?: number;
  derrotas?: number;
  [key: string]: any;
};

/**
 * Fetches all roulettes from the API or MongoDB
 * @returns {Promise<Roulette[]>} Array of roulette objects
 */
export async function fetchAllRoulettes(): Promise<Roulette[]> {
  try {
    // First try to fetch from our API backend
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
      const response = await axios.get(`${apiUrl}/api/roulettes`);
      
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        console.log('[Supabase Client] Returning data from API:', response.data.length, 'roulettes');
        return response.data;
      }
    } catch (apiError) {
      console.error('[Supabase Client] Error fetching from API, falling back to Supabase:', apiError);
    }
    
    // If API fails, try Supabase
    const { data, error } = await supabase
      .from('roulettes')
      .select('*');
      
    if (error) {
      throw error;
    }
    
    if (!data || data.length === 0) {
      // If no data in Supabase, return mock data
      console.warn('[Supabase Client] No data from Supabase, returning mock data');
      return [
        {
          id: '1',
          name: 'Roleta Brasileira',
          vitorias: 150,
          derrotas: 50
        },
        {
          id: '2',
          name: 'Roleta Europeia',
          vitorias: 180,
          derrotas: 70
        },
        {
          id: '3',
          name: 'Roleta Americana',
          vitorias: 200,
          derrotas: 90
        }
      ];
    }
    
    return data;
  } catch (error) {
    console.error('[Supabase Client] Error:', error);
    throw error;
  }
}
