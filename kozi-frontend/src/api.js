// src/api.js
const DEMO_CONFIG = {
  // Update this to match your backend server
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
  demoUser: { email: 'demo@kozi.rw', user_type: 'employee' }
};

export async function getOrCreateDemoUser() {
  try {
    // Try GET first
    const r = await fetch(`${DEMO_CONFIG.baseURL}/profile/user/${DEMO_CONFIG.demoUser.email}`);
    if (r.ok) {
      const data = await r.json();
      return data.data;
    }
    
    // Create if doesn't exist
    const c = await fetch(`${DEMO_CONFIG.baseURL}/profile/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(DEMO_CONFIG.demoUser)
    });
    
    if (!c.ok) {
      throw new Error(`Failed to create user: ${c.status}`);
    }
    
    const created = await c.json();
    return created.data;
  } catch (error) {
    console.error('Error with demo user:', error);
    throw error;
  }
}

export async function startSession(user_id) {
  try {
    const r = await fetch(`${DEMO_CONFIG.baseURL}/chat/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id })
    });
    
    if (!r.ok) {
      throw new Error(`Failed to start session: ${r.status}`);
    }
    
    return r.json();
  } catch (error) {
    console.error('Error starting session:', error);
    throw error;
  }
}

export async function sendChatMessage(session_id, user_id, message) {
  try {
    const r = await fetch(`${DEMO_CONFIG.baseURL}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id, user_id, message })
    });
    
    if (!r.ok) {
      throw new Error(`Failed to send message: ${r.status}`);
    }
    
    return r.json();
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

export async function getChatHistory(session_id) {
  try {
    const r = await fetch(`${DEMO_CONFIG.baseURL}/chat/history/${session_id}`);
    
    if (!r.ok) {
      throw new Error(`Failed to get history: ${r.status}`);
    }
    
    return r.json();
  } catch (error) {
    console.error('Error getting chat history:', error);
    throw error;
  }
}