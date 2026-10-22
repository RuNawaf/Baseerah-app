// Every error the API can return. Messages are written for the developer using Baseerah,
// so they say what happened and what to do next. They never include server internals.
export const ERROR_CODES = {
  EMPTY_URL: {
    status: 400,
    message: 'Enter a website URL to scan.',
  },
  INVALID_URL: {
    status: 400,
    message: 'This is not a valid web address. Check the spelling, for example https://www.ksu.edu.sa.',
  },
  UNSUPPORTED_PROTOCOL: {
    status: 400,
    message: 'Only http:// and https:// addresses can be scanned.',
  },
  CREDENTIALS_NOT_ALLOWED: {
    status: 400,
    message: 'Remove the username or password from the address. Baseerah only scans public pages.',
  },
  BLOCKED_ADDRESS: {
    status: 400,
    message:
      'This address points to a private or internal network (such as localhost). Baseerah only scans public websites.',
  },
  DNS_NOT_FOUND: {
    status: 422,
    message: 'No website was found at this domain. Check that the domain name is spelled correctly.',
  },
  UNREACHABLE: {
    status: 422,
    message: 'The website could not be reached. Check that it is online and publicly accessible.',
  },
  TIMEOUT: {
    status: 422,
    message: 'The website took too long to respond. Try again later or check that it is online.',
  },
  HTTP_ERROR: {
    status: 422,
    message: 'The website responded with an error status, so it cannot be scanned.',
  },
  TOO_MANY_REDIRECTS: {
    status: 422,
    message: 'The website redirects too many times to be scanned.',
  },
  UNSUPPORTED_CONTENT: {
    status: 422,
    message: 'This address does not return an HTML web page, so it cannot be scanned.',
  },
  NAVIGATION_FAILED: {
    status: 502,
    message: 'The page could not be loaded in the scanning browser.',
  },
  REDIRECTED_EXTERNAL: {
    status: 422,
    message: 'The page redirects to a different website, so it was not scanned.',
  },
  ANALYSIS_FAILED: {
    status: 502,
    message: 'The page loaded, but the accessibility checks could not run on it.',
  },
  SCAN_FAILED: {
    status: 502,
    message: 'The scan could not be completed because of an unexpected scanner error.',
  },
  SCAN_NOT_FOUND: {
    status: 404,
    message: 'This scan does not exist or has expired. Start a new scan.',
  },
  SCANNER_BUSY: {
    status: 503,
    message: 'The scanner is busy with other scans. Try again in a minute.',
  },
  RATE_LIMITED: {
    status: 429,
    message: 'Too many scans were started from your network. Wait a minute and try again.',
  },
  INVALID_REQUEST: {
    status: 400,
    message: 'The request body must be JSON with a "url" field.',
  },
  PAYLOAD_TOO_LARGE: {
    status: 413,
    message: 'The request is too large.',
  },
  NOT_FOUND: {
    status: 404,
    message: 'This API endpoint does not exist.',
  },
  INTERNAL_ERROR: {
    status: 500,
    message: 'Something went wrong on the server. Try again later.',
  },
};

export function describeError(code) {
  return ERROR_CODES[code] ?? ERROR_CODES.INTERNAL_ERROR;
}