
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.26.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the Auth context of the function
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get existing count to prevent duplicate seeding
    const { count } = await supabase
      .from('recent_numbers')
      .select('*', { count: 'exact', head: true })

    // If we already have data, don't seed again
    if (count && count > 0) {
      return new Response(
        JSON.stringify({ message: "Data already seeded" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      )
    }

    // Seed data for each roulette type
    const rouletteNames = [
      "Roleta Brasileira",
      "Roleta Europeia",
      "Roleta Americana",
      "Roleta Platinum VIP",
      "Roleta Diamond",
      "Roleta Gold",
      "Roleta Lightning",
      "Roleta Premium",
      "Roleta Turbo"
    ]

    const getColorForNumber = (num: number) => {
      if (num === 0) return "green"
      
      // Red numbers in roulette
      const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
      
      return redNumbers.includes(num) ? "red" : "black"
    }

    // Generate random numbers for each roulette
    const seedData = []
    
    for (const name of rouletteNames) {
      // Generate 10 random numbers for each roulette
      for (let i = 0; i < 10; i++) {
        const number = Math.floor(Math.random() * 37) // 0-36
        const color = getColorForNumber(number)
        
        // Adjust timestamp to be in the past, with most recent first
        const timestamp = new Date()
        timestamp.setMinutes(timestamp.getMinutes() - i * 5) // Each number 5 minutes apart
        
        seedData.push({
          roulette_name: name,
          number,
          color,
          timestamp: timestamp.toISOString()
        })
      }
    }

    // Insert the data
    const { data, error } = await supabase
      .from('recent_numbers')
      .insert(seedData)
      .select()

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({ 
        message: "Seeded roulette numbers successfully", 
        count: seedData.length 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    )
  }
})
