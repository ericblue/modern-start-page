import type { APIRoute } from 'astro';
import { initializeConfig } from '../../config/init';

// Ensure this route is not prerendered
export const prerender = false;

// Define the POST handler
export const POST: APIRoute = async ({ request }) => {
  try {
    const newConfig = await request.json();
    const configStore = await initializeConfig(newConfig.user);
    await configStore.saveConfig(newConfig);
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error saving config:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}; 