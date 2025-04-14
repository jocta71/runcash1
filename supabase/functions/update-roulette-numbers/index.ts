
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.26.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Verificador de API key
const API_KEY = Deno.env.get("SCRAPER_API_KEY") || ""

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Verificar a API key
    const authorization = req.headers.get('authorization')
    if (!authorization || authorization !== `Bearer ${API_KEY}`) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      )
    }

    // Extrair dados do corpo da requisição
    const { rouletteName, numbers } = await req.json()

    if (!rouletteName || !numbers || !Array.isArray(numbers)) {
      return new Response(
        JSON.stringify({ error: "Dados inválidos. Formato esperado: { rouletteName: string, numbers: number[] }" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      )
    }

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Função para obter a cor de um número de roleta
    const getColorForNumber = (num: number) => {
      if (num === 0) return "green"
      
      // Números vermelhos na roleta
      const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
      
      return redNumbers.includes(num) ? "red" : "black"
    }

    // Preparar dados para inserção
    const dataToInsert = numbers.map((number, index) => ({
      roulette_name: rouletteName,
      number,
      color: getColorForNumber(number),
      // Ajustar timestamp para que os números mais recentes apareçam primeiro
      timestamp: new Date(Date.now() - (index * 300000)).toISOString(), // 5 minutos de diferença
    }))

    // Inserir dados no Supabase
    const { data, error } = await supabase
      .from('recent_numbers')
      .insert(dataToInsert)
      .select()

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${dataToInsert.length} número(s) adicionado(s) com sucesso`,
        data
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (error) {
    console.error("Erro ao processar dados:", error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})
