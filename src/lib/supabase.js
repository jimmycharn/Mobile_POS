import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let supabase

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey)
} else {
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')

  // Chainable dummy query builder
  const buildDummy = () => {
    const chain = () => buildDummy()
    return new Proxy({}, {
      get(_, prop) {
        if (prop === 'then') return undefined
        if (prop === 'catch') return (fn) => Promise.resolve({ data: null, error: null }).catch(fn)
        if (['single', 'maybeSingle'].includes(prop)) {
          return () => Promise.resolve({ data: null, error: null })
        }
        return chain
      },
    })
  }

  const dummyQuery = buildDummy()

  supabase = {
    from: () => dummyQuery,
    auth: {
      signInWithPassword: () => Promise.resolve({ data: null, error: null }),
      signUp: () => Promise.resolve({ data: null, error: null }),
      signOut: () => Promise.resolve({ error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    },
  }
}

export { supabase }
