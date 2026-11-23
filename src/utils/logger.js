/** Log interno: stack traces vão para o console do SERVIDOR, nunca para a resposta HTTP. */
export const logger = {
  error(message, err, context = {}) {
    console.error(
      JSON.stringify({
        level: 'error',
        timestamp: new Date().toISOString(),
        message,
        ...context,
        errorName: err?.name,
        errorMessage: err?.message,
        stack: err?.stack,
      }),
    );
  },
};
