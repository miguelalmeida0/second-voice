export const anonymousVisitor = {
  description: "Unauthenticated public visitor with a shield session",
  expectedCookies: {
    csrf: "gw_csrf",
    session: "gw_session",
  },
};

export const returningVisitor = {
  localStorage: {
    outcome: "second_voice_outcome",
    rewriteMode: "second_voice_rewrite_mode",
  },
};
