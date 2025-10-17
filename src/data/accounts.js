export const DEFAULT_ACCOUNTS = [
  {
    id: "mauro",
    label: "Mauro Filho - Deputado",
    facebookPageId: "1432229983657475",
    instagramUserId: "17841406203805133",
    adAccountId: "act_653031036533289",
  },
];

export function createDefaultAccounts() {
  return DEFAULT_ACCOUNTS.map((account) => ({ ...account }));
}
