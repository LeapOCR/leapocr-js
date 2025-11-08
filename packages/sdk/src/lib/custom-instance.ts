import Axios, { AxiosError, AxiosRequestConfig } from 'axios';

/**
 * Axios instance for LeapOCR API
 * This will be configured by the SDK client with API key and base URL
 */
export const AXIOS_INSTANCE = Axios.create({
  baseURL: '',  // Will be set by SDK
});

/**
 * Custom instance for Orval-generated client
 * This function is used as the mutator in Orval config
 */
export const customInstance = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => {
  const source = Axios.CancelToken.source();

  const promise = AXIOS_INSTANCE({
    ...config,
    ...options,
    cancelToken: source.token,
  }).then(({ data }) => data);

  // @ts-ignore
  promise.cancel = () => {
    source.cancel('Query was cancelled');
  };

  return promise;
};

/**
 * Error type for Orval-generated client
 */
export type ErrorType<Error> = AxiosError<Error>;

/**
 * Body type for Orval-generated client
 */
export type BodyType<BodyData> = BodyData;
