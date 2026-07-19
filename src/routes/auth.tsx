import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dumbbell, Loader2, Check, Circle } from "lucide-react";
import { toast } from "sonner";
import { displayNameSchema, emailSchema, passwordSchema } from "@/lib/validation";



// Mapeia códigos e mensagens do Supabase Auth (GoTrue) para pt-BR.
// Referência: https://supabase.com/docs/guides/auth/debugging/error-codes
const AUTH_ERROR_CODE_MAP: Record<string, string> = {
  anonymous_provider_disabled: "Login anônimo está desativado.",
  bad_code_verifier: "Falha na verificação do login. Tente novamente.",
  bad_json: "Requisição inválida. Recarregue a página e tente de novo.",
  bad_jwt: "Sessão inválida. Faça login novamente.",
  bad_oauth_callback: "Falha no retorno do login social. Tente novamente.",
  bad_oauth_state: "Sessão de login social expirou. Tente novamente.",
  captcha_failed: "Falha na verificação de segurança (captcha). Tente novamente.",
  conflict: "Conflito ao processar a requisição. Tente novamente.",
  email_address_invalid: "Email inválido.",
  email_address_not_authorized: "Este email não está autorizado a acessar o app.",
  email_exists: "Já existe uma conta com esse email.",
  email_not_confirmed: "Confirme seu email antes de entrar. Verifique sua caixa de entrada e a pasta de spam.",
  email_provider_disabled: "Cadastro por email está desativado.",
  flow_state_expired: "O link expirou. Solicite um novo.",
  flow_state_not_found: "Link inválido ou já utilizado. Solicite um novo.",
  identity_already_exists: "Esta identidade já está vinculada a outra conta.",
  identity_not_found: "Identidade não encontrada.",
  insufficient_aal: "É necessária autenticação em duas etapas para continuar.",
  invalid_credentials: "Email ou senha incorretos.",
  invite_not_found: "Convite não encontrado ou expirado.",
  manual_linking_disabled: "Vinculação manual de contas está desativada.",
  mfa_challenge_expired: "O desafio de verificação expirou. Tente novamente.",
  mfa_factor_name_conflict: "Já existe um fator com esse nome.",
  mfa_factor_not_found: "Fator de autenticação não encontrado.",
  mfa_verification_failed: "Código de verificação incorreto.",
  no_authorization: "Você precisa entrar para continuar.",
  not_admin: "Você não tem permissão para esta ação.",
  oauth_provider_not_supported: "Provedor de login social não suportado.",
  otp_disabled: "Login por código único está desativado.",
  otp_expired: "O código expirou. Solicite um novo.",
  over_email_send_rate_limit: "Muitos emails enviados. Aguarde alguns minutos e tente novamente.",
  over_request_rate_limit: "Muitas tentativas em pouco tempo. Aguarde alguns minutos.",
  over_sms_send_rate_limit: "Muitos SMS enviados. Aguarde alguns minutos.",
  phone_exists: "Já existe uma conta com esse telefone.",
  phone_not_confirmed: "Confirme seu telefone antes de entrar.",
  phone_provider_disabled: "Cadastro por telefone está desativado.",
  provider_disabled: "Este método de login está desativado.",
  provider_email_needs_verification: "Confirme o email deste provedor antes de continuar.",
  reauthentication_needed: "Confirme sua senha novamente para continuar.",
  reauthentication_not_valid: "Falha na reautenticação. Tente novamente.",
  refresh_token_not_found: "Sua sessão expirou. Faça login novamente.",
  refresh_token_already_used: "Sessão expirada. Faça login novamente.",
  request_timeout: "A solicitação demorou demais. Verifique sua conexão e tente novamente.",
  same_password: "A nova senha precisa ser diferente da anterior.",
  saml_assertion_no_email: "O provedor SAML não retornou um email.",
  saml_assertion_no_user_id: "O provedor SAML não retornou um identificador de usuário.",
  session_expired: "Sua sessão expirou. Faça login novamente.",
  session_not_found: "Sessão não encontrada. Faça login novamente.",
  signup_disabled: "Novos cadastros estão desativados no momento.",
  single_identity_not_deletable: "Não é possível remover a única identidade da conta.",
  sms_send_failed: "Não foi possível enviar o SMS. Tente novamente.",
  too_many_enrolled_mfa_factors: "Você atingiu o limite de fatores de autenticação.",
  unexpected_audience: "Token inválido para este aplicativo.",
  unexpected_failure: "Ocorreu um erro inesperado. Tente novamente.",
  user_already_exists: "Já existe uma conta com esse email.",
  user_banned: "Esta conta foi bloqueada. Entre em contato com o suporte.",
  user_not_found: "Usuário não encontrado.",
  user_sso_managed: "Esta conta é gerenciada por SSO. Entre pelo seu provedor.",
  validation_failed: "Dados inválidos. Verifique os campos e tente novamente.",
  weak_password: "Senha muito fraca. Use uma combinação mais forte (letras maiúsculas, minúsculas, números e símbolos).",
  password_compromised: "Essa senha apareceu em vazamentos conhecidos. Escolha outra que você nunca tenha usado.",
  password_too_short: "Senha muito curta. Use pelo menos 8 caracteres.",
};

function translateAuthError(err: unknown): string {
  // Suporta AuthError, PostgrestError e Error genérico.
  const anyErr = (err ?? {}) as { code?: string; error_code?: string; name?: string; message?: string; status?: number };
  const rawMsg = typeof err === "string" ? err : anyErr.message ?? "";
  const code = (anyErr.code || anyErr.error_code || "").toString().toLowerCase();
  if (code && AUTH_ERROR_CODE_MAP[code]) return AUTH_ERROR_CODE_MAP[code];

  const m = rawMsg.toLowerCase();

  // Senhas fracas / vazadas (HIBP / regras locais).
  if (m.includes("pwned") || m.includes("compromised") || m.includes("breach") || m.includes("has been leaked")) {
    return AUTH_ERROR_CODE_MAP.password_compromised;
  }
  if (m.includes("weak password") || m.includes("password is too weak") || m.includes("easy") || m.includes("common password")) {
    return AUTH_ERROR_CODE_MAP.weak_password;
  }
  if (m.includes("password") && (m.includes("short") || m.includes("at least") || m.includes("minimum"))) {
    return AUTH_ERROR_CODE_MAP.password_too_short;
  }
  if (m.includes("password should contain") || m.includes("password must contain")) {
    return "A senha precisa conter os caracteres exigidos (letras, números e símbolos).";
  }

  // Login / credenciais
  if (m.includes("invalid login") || m.includes("invalid credentials") || m.includes("invalid email or password")) {
    return AUTH_ERROR_CODE_MAP.invalid_credentials;
  }
  if (m.includes("email not confirmed") || m.includes("email address not confirmed")) return AUTH_ERROR_CODE_MAP.email_not_confirmed;
  if (m.includes("phone not confirmed")) return AUTH_ERROR_CODE_MAP.phone_not_confirmed;
  if (m.includes("user already registered") || m.includes("already been registered") || m.includes("already exists") || m.includes("duplicate key")) {
    return AUTH_ERROR_CODE_MAP.user_already_exists;
  }
  if (m.includes("user not found")) return AUTH_ERROR_CODE_MAP.user_not_found;
  if (m.includes("user banned") || m.includes("banned")) return AUTH_ERROR_CODE_MAP.user_banned;

  // Formatos / validação
  if (m.includes("invalid email") || m.includes("email address is invalid") || m.includes("email address") && m.includes("invalid")) {
    return AUTH_ERROR_CODE_MAP.email_address_invalid;
  }
  if (m.includes("invalid phone")) return "Telefone inválido.";
  if (m.includes("validation")) return AUTH_ERROR_CODE_MAP.validation_failed;

  // Sessão / tokens
  if (m.includes("jwt expired") || m.includes("session expired") || m.includes("token has expired")) return AUTH_ERROR_CODE_MAP.session_expired;
  if (m.includes("jwt") && m.includes("invalid")) return AUTH_ERROR_CODE_MAP.bad_jwt;
  if (m.includes("refresh token") && (m.includes("not found") || m.includes("expired") || m.includes("revoked"))) {
    return AUTH_ERROR_CODE_MAP.refresh_token_not_found;
  }

  // OTP / MFA
  if (m.includes("token has expired") || m.includes("otp expired")) return AUTH_ERROR_CODE_MAP.otp_expired;
  if (m.includes("otp") && m.includes("invalid")) return "Código de verificação inválido.";
  if (m.includes("mfa")) return AUTH_ERROR_CODE_MAP.mfa_verification_failed;

  // Rate limit
  if (m.includes("rate limit") || m.includes("too many requests") || m.includes("too many") || anyErr.status === 429) {
    if (m.includes("email")) return AUTH_ERROR_CODE_MAP.over_email_send_rate_limit;
    if (m.includes("sms")) return AUTH_ERROR_CODE_MAP.over_sms_send_rate_limit;
    return AUTH_ERROR_CODE_MAP.over_request_rate_limit;
  }

  // Cadastro / provedores
  if (m.includes("signup") && m.includes("disabled")) return AUTH_ERROR_CODE_MAP.signup_disabled;
  if (m.includes("provider") && m.includes("disabled")) return AUTH_ERROR_CODE_MAP.provider_disabled;
  if (m.includes("captcha")) return AUTH_ERROR_CODE_MAP.captcha_failed;

  // Rede
  if (m.includes("failed to fetch") || m.includes("network") || m.includes("networkerror")) {
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  }
  if (m.includes("timeout")) return AUTH_ERROR_CODE_MAP.request_timeout;

  // Servidor
  if (anyErr.status && anyErr.status >= 500) return AUTH_ERROR_CODE_MAP.unexpected_failure;

  return rawMsg || "Ocorreu um erro inesperado. Tente novamente.";
}

function PasswordChecklist({ password }: { password: string }) {
  const rules = [
    { label: "Pelo menos 8 caracteres", ok: password.length >= 8 },
    { label: "Uma letra maiúscula (A-Z)", ok: /[A-Z]/.test(password) },
    { label: "Uma letra minúscula (a-z)", ok: /[a-z]/.test(password) },
    { label: "Um número (0-9)", ok: /\d/.test(password) },
    { label: "Um símbolo (ex.: !, @, #, $)", ok: /[^A-Za-z0-9]/.test(password) },
  ];
  return (
    <ul className="mt-1 space-y-1 text-xs" aria-label="Requisitos de senha recomendados">
      {rules.map((r) => (
        <li key={r.label} className={"flex items-center gap-1.5 " + (r.ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
          {r.ok ? <Check className="size-3.5" aria-hidden /> : <Circle className="size-3.5" aria-hidden />}
          <span>{r.label}</span>
        </li>
      ))}
      <li className="pt-1 text-[11px] text-muted-foreground">Sugestões para uma senha forte — não são obrigatórias para criar a conta.</li>
    </ul>
  );
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//") ? s.next : "",
  }),
  component: AuthPage,
});

function AuthPage() {
  const { next } = Route.useSearch();

  const redirectTo = next || "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"student" | "trainer">("student");
  const [busy, setBusy] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = redirectTo;
    });
  }, [redirectTo]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  async function resendConfirmation() {
    if (!pendingEmail || resendCooldown > 0 || resending) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
      options: { emailRedirectTo: `${window.location.origin}${redirectTo}` },
    });
    setResending(false);
    if (error) {
      toast.error(translateAuthError(error));
      // Se foi rate-limit, respeita cooldown maior.
      const m = (error.message || "").toLowerCase();
      if (m.includes("rate") || m.includes("too many")) setResendCooldown(60);
      return;
    }
    toast.success(`Email de confirmação reenviado para ${pendingEmail}.`);
    setResendCooldown(60);
  }




  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) return toast.error(parsedEmail.error.issues[0]?.message ?? "Email inválido.");
    if (!password) return toast.error("Informe sua senha.");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: parsedEmail.data, password });
    setBusy(false);
    if (error) return toast.error(translateAuthError(error));
    window.location.href = redirectTo;
  }


  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) return toast.error(parsedEmail.error.issues[0]?.message ?? "Email inválido.");
    const parsedPassword = passwordSchema.safeParse(password);
    if (!parsedPassword.success) return toast.error(parsedPassword.error.issues[0]?.message ?? "Senha inválida.");
    const nameCandidate = name.trim() || parsedEmail.data.split("@")[0];
    const parsedName = displayNameSchema.safeParse(nameCandidate);
    if (!parsedName.success) return toast.error(parsedName.error.issues[0]?.message ?? "Nome inválido.");
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsedEmail.data,
      password: parsedPassword.data,
      options: {
        emailRedirectTo: `${window.location.origin}${redirectTo}`,
        data: { display_name: parsedName.data, role },
      },
    });
    setBusy(false);
    if (error) return toast.error(translateAuthError(error));

    const needsConfirmation = !data.session;
    if (needsConfirmation) {
      setPendingEmail(parsedEmail.data);
      setResendCooldown(60);
      toast.success(
        `Enviamos um email de confirmação para ${parsedEmail.data}. Abra sua caixa de entrada (e a pasta de spam) e clique no link para ativar sua conta.`,
        { duration: 8000 },
      );
      return;
    }
    toast.success("Conta criada com sucesso!");
    window.location.href = redirectTo;
  }



  async function google() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}${redirectTo}`,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Erro ao entrar com Google");
      return;
    }
    if (result.redirected) return;
    setBusy(false);
    window.location.href = redirectTo;

  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 self-start">
          <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Dumbbell className="size-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">Carga</span>
        </Link>

        <h1 className="text-2xl font-bold">Acesse sua conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">Seus treinos salvos, sincronizados em qualquer aparelho.</p>

        <Button variant="outline" onClick={google} disabled={busy} className="mt-6 h-11">
          <svg className="size-4" viewBox="0 0 24 24" aria-hidden><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continuar com Google
        </Button>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">ou com email</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Tabs defaultValue="signin">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Criar conta</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <form onSubmit={signIn} className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Senha</Label>
                <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" disabled={busy} className="h-11 w-full">
                {busy ? <Loader2 className="size-4 animate-spin" /> : "Entrar"}
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="signup">
            <form onSubmit={signUp} className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label>Sou...</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { v: "student", label: "Aluno(a)", desc: "Vou treinar" },
                    { v: "trainer", label: "Professor(a)", desc: "Monto treinos" },
                  ].map((opt) => (
                    <button
                      type="button"
                      key={opt.v}
                      onClick={() => setRole(opt.v as "student" | "trainer")}
                      className={
                        "rounded-lg border p-3 text-left transition-colors " +
                        (role === opt.v
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-secondary/40")
                      }
                    >
                      <p className="text-sm font-semibold">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Como podemos te chamar?" maxLength={60} autoComplete="name" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label>Senha</Label>
                <Input type="password" required maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="Crie uma senha" />
                <PasswordChecklist password={password} />
              </div>
              <Button type="submit" disabled={busy} className="h-11 w-full">
                {busy ? <Loader2 className="size-4 animate-spin" /> : "Criar conta"}
              </Button>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Ao criar sua conta você concorda com nossos{" "}
                <Link to="/termos" className="underline underline-offset-2 hover:text-foreground">Termos de Uso</Link>
                {" "}e a{" "}
                <Link to="/privacidade" className="underline underline-offset-2 hover:text-foreground">Política de Privacidade</Link>.
              </p>
            </form>
          </TabsContent>
        </Tabs>

        <div className="mt-8 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <Link to="/privacidade" className="hover:text-foreground">Privacidade</Link>
          <span aria-hidden>·</span>
          <Link to="/termos" className="hover:text-foreground">Termos</Link>
        </div>
      </div>
    </div>
  );
}
