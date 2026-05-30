import axios from 'axios';
import { logger } from '../utils/logger';

const api = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    logger.debug(`Request: ${config.method?.toUpperCase()} ${config.url}`, {
      params: config.params,
      hasBody: !!config.data,
    });
    return config;
  },
  (error) => {
    logger.error('Request interceptor error', { error: error.message });
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    logger.debug(`Response: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`);
    return response;
  },
  (error) => {
    const { config, response } = error;
    const status = response?.status || 'NETWORK_ERROR';
    const method = config?.method?.toUpperCase() || 'UNKNOWN';
    const url = config?.url || 'unknown';
    logger.error(`Response error: ${status} ${method} ${url}`, {
      status,
      data: response?.data,
    });
    return Promise.reject(error);
  }
);

export default api;
