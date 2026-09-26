// Domain helpers shared by the dashboard UI and the MCP server, so both
// normalize and validate origin/target domains the same way.

const DOMAIN_REGEX = /^[a-zA-Z0-9][-a-zA-Z0-9]*(\.[a-zA-Z0-9][-a-zA-Z0-9]*)+$/;

export const isValidDomain = (domain: string): boolean =>
  DOMAIN_REGEX.test(domain);

// Target domains also accept "*", meaning all domains.
export const isValidTargetDomain = (domain: string): boolean =>
  domain === "*" || isValidDomain(domain);

// Turns user input such as "https://www.example.com/path?x=1" into
// "www.example.com". Input that does not look like a domain is returned
// unchanged so the caller can report it back as invalid.
export const extractDomainFromInput = (input: string): string => {
  if (!input || !input.trim()) {
    return "";
  }

  let cleanInput = input.trim();
  cleanInput = cleanInput.replace(/^(https?:\/\/|\/\/)/i, "");
  cleanInput = cleanInput.split("/")[0].split("?")[0].split("#")[0];
  cleanInput = cleanInput.split(":")[0];
  cleanInput = cleanInput.toLowerCase();

  if (isValidDomain(cleanInput)) {
    return cleanInput;
  }

  return input;
};
