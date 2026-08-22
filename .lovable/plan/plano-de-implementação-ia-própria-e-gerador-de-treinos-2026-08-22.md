# Plano de Implementação: IA Própria e Gerador de Treinos

Implementação de um sistema que permite aos usuários utilizarem suas próprias chaves de API (OpenAI, Anthropic, Gemini) e uma funcionalidade para gerar planos de treino completos via IA.

## Mudanças

### Backend (Supabase)
- Criar tabela `user_ai_configs` para armazenar o provedor e a chave de API (criptografada no transporte via SSL e protegida por RLS).
- Definir enum `ai_provider` com os valores: `openai`, `anthropic`, `google`.
- Garantir políticas de RLS para que o usuário acesse apenas sua própria configuração.

### Server Functions e Gateway
- **Centralização:** Criar um roteador de IA que verifica se o usuário possui chave própria.
- **Normalização:** Padronizar prompts e respostas (JSON) para consistência entre diferentes modelos/provedores.
- **Validação:** Implementar rotina de teste de chave antes de salvar.

### UI (Perfil e Treino)
- **Perfil:** Adicionar seção "Configurações de IA" com campo de chave (password), seletor de provedor e ações de Validar/Salvar/Remover.
- **Gerador de Treinos:** Nova tela ou modal para coletar objetivos, frequência e equipamentos, gerando um plano completo para revisão e salvamento.

## Detalhes Técnicos

- **Segurança:** As chaves nunca são expostas no client-side após o salvamento inicial (apenas via bridge-actions seguras).
- **Fallback:** Se o usuário não tiver chave, o app continua usando a infraestrutura padrão.
- **Prompt Engineering:** Instrução de sistema fixa para garantir que o JSON retornado seja compatível com o parser do app.

```text
[Usuário] -> [App UI] -> [Server Function] -> [AI Router]
                                                  |
                          ------------------------------------------------
                          |                                              |
                 [Possui Chave Própria?]                         [Usa Chave Padrão]
                          |                                              |
                [Chama API do Provedor]                        [Chama Gateway Lovable]
```
