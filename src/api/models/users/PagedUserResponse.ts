import { UserDTO } from './UserDTO';

export interface PagedUserResponse {
  values: UserDTO[];
  pagingInformation: {
    pageNumber: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  information?: string[];
} 