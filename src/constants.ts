// Constants only needed by the backend
// Constants shared should go in shared npm package.

export const JWTSecret = 'jwt_secret';

export const DefaultGenreInterestLevel = 3;
export const NumReviewsToBaseCLM = 3;

export const HashedPassSaltLen = 8;

export const BackdoorPassword = 'talktogirlstoday';

// dont show students books this far above their lexile measure
export const AboveStudentLexileThreshold = 150