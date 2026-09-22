# V20 — Sincronização automática sem spam

A sincronização automática no login/recarregamento agora consulta primeiro os registros existentes no Supabase e envia apenas produtos e batidas cujo ID ainda não existe na nuvem. Isso evita UPDATEs artificiais e notificações repetidas provocadas pelo simples login ou recarregamento.

A sincronização manual continua disponível para operações de manutenção.
