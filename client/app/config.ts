export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
export const BASE_PATH = IS_PRODUCTION ? '/techfenixscoutapp' : '';
export const API_BASE = IS_PRODUCTION ? '/api' : 'http://localhost:8000';