import { StringFilter } from '../baseFilter';

export interface UserFilter {
  firstName?: StringFilter;
  lastName?: StringFilter;
  // Add other filter fields as needed
}