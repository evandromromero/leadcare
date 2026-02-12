import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { chatId, phoneNumber, avatarUrl, forceRefresh } = await req.json()

    if (!chatId || !avatarUrl) {
      return new Response(
        JSON.stringify({ error: 'chatId and avatarUrl are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar se já existe um avatar salvo para este chat
    const { data: chat } = await supabase
      .from('chats')
      .select('avatar_url')
      .eq('id', chatId)
      .single()

    // Se já tem uma URL do storage e não é forceRefresh, retornar cache
    if (!forceRefresh && chat?.avatar_url && chat.avatar_url.includes('supabase.co/storage')) {
      return new Response(
        JSON.stringify({ success: true, avatarUrl: chat.avatar_url, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Baixar a imagem do WhatsApp
    console.log('Downloading avatar from:', avatarUrl.substring(0, 100))
    
    const imageResponse = await fetch(avatarUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!imageResponse.ok) {
      console.error('Failed to download avatar:', imageResponse.status)
      return new Response(
        JSON.stringify({ error: 'Failed to download avatar', status: imageResponse.status }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const imageBlob = await imageResponse.blob()
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg'
    
    // Determinar extensão do arquivo
    let extension = 'jpg'
    if (contentType.includes('png')) extension = 'png'
    else if (contentType.includes('webp')) extension = 'webp'
    else if (contentType.includes('gif')) extension = 'gif'

    // Nome do arquivo: avatars/{chatId}.{extension}
    const fileName = `avatars/${chatId}.${extension}`

    // Fazer upload para o Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('chat-media')
      .upload(fileName, imageBlob, {
        contentType,
        upsert: true, // Substituir se já existir
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return new Response(
        JSON.stringify({ error: 'Failed to upload avatar', details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Gerar URL pública
    const { data: publicUrlData } = supabase.storage
      .from('chat-media')
      .getPublicUrl(fileName)

    const permanentUrl = publicUrlData.publicUrl

    // Atualizar o chat com a nova URL permanente
    const now = new Date().toISOString()
    await supabase
      .from('chats')
      .update({ 
        avatar_url: permanentUrl, 
        avatar_updated_at: now,
        updated_at: now 
      })
      .eq('id', chatId)

    console.log('Avatar saved successfully:', permanentUrl)

    return new Response(
      JSON.stringify({ success: true, avatarUrl: permanentUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
