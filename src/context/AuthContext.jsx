import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext({
  user: null,
  session: null,
  role: null,
  loading: true,
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = useCallback(async (userId) => {
    if (!userId) return null;
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao buscar role do usuario no Supabase', error);
        return null;
      }
      return data?.role ?? null;
    } catch (err) {
      console.error('Erro inesperado ao buscar role do usuario no Supabase', err);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;

    const applySession = async (nextSession) => {
      if (!active) return;
      setSession(nextSession);
      const nextUser = nextSession?.user ?? null;
      setUser(nextUser);
      if (!nextUser?.id) {
        setRole(null);
        return;
      }
      const nextRole = await fetchUserRole(nextUser.id);
      if (!active) return;
      setRole(nextRole);
    };

    const loadSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Erro ao carregar sessao do Supabase', error);
        }
        await applySession(data?.session ?? null);
      } catch (err) {
        console.error('Erro inesperado ao carregar sessao do Supabase', err);
        if (active) {
          setSession(null);
          setUser(null);
          setRole(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession).catch((err) => {
        console.error('Erro ao sincronizar sessao do Supabase', err);
      });
    });

    return () => {
      active = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, [fetchUserRole]);

  const value = useMemo(
    () => ({
      user,
      session,
      role,
      loading,
      async signInWithPassword(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        if (data?.session) {
          setSession(data.session);
          const nextUser = data.session.user ?? data.user ?? null;
          setUser(nextUser);
          if (nextUser?.id) {
            const nextRole = await fetchUserRole(nextUser.id);
            setRole(nextRole);
          } else {
            setRole(null);
          }
        }

        return data;
      },
      async signUp(email, password, nome) {
        const normalizedEmail = String(email || '').trim();
        const normalizedNome = String(nome || '').trim();

        // Cadastrar no Supabase Auth com metadata
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              nome: normalizedNome,
            }
          }
        });

        if (error) {
          console.error('Erro no signUp do Supabase Auth:', error);
          throw error;
        }

        const newUser = data?.user ?? data?.session?.user;

        if (newUser?.id) {
          // Aguardar trigger criar o perfil
          await new Promise(resolve => setTimeout(resolve, 800));

          try {
            // Verificar se o trigger criou o perfil
            const { data: existingProfile, error: fetchError } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('id', newUser.id)
              .maybeSingle();

            if (fetchError && fetchError.code !== 'PGRST116') {
              console.error('Erro ao buscar perfil:', fetchError);
            }

            // Se o trigger não criou, criar manualmente
            if (!existingProfile) {
              console.log('Trigger não criou perfil, criando manualmente...');
              const { error: profileError } = await supabase
                .from('user_profiles')
                .insert({
                  id: newUser.id,
                  nome: normalizedNome,
                  role: 'analista',
                });

              if (profileError) {
                console.error('Erro ao criar perfil manualmente:', profileError);
                console.warn('Continuando mesmo assim...');
              }
            } else {
              console.log('Perfil criado pelo trigger:', existingProfile);
            }

            const nextRole = await fetchUserRole(newUser.id);
            setRole(nextRole ?? 'analista');
          } catch (profileErr) {
            console.error('Erro ao processar perfil:', profileErr);
            setRole('analista');
          }
        }

        if (data?.session) {
          setSession(data.session);
          setUser(data.session.user ?? newUser ?? null);
        } else if (newUser) {
          setUser(newUser);
        }

        return data;
      },
      async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        setSession(null);
        setUser(null);
        setRole(null);
      },
    }),
    [user, session, role, loading, fetchUserRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
