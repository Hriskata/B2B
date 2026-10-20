// Public facts about the site operator, used on Contacts and in the legal
// pages. Nothing here is invented: every value is null until the owner gives
// it (plan, phase 6: "данни на администратора"), and the pages then show
// "ЧАКА ДАННИ" instead of a made-up value.

export const SITE = {
  name: "ODFFiber", // text brand until the logo is provided
  operator: {
    legalName: null as string | null,
    eik: null as string | null,
    address: null as string | null,
    email: null as string | null,
    phone: null as string | null,
  },
};

export const PENDING = "ЧАКА ДАННИ";
