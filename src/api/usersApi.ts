import { postData } from './api';
import { UserFilter } from './models/users/UserFilter';
import { PagedUserResponse } from './models/users/PagedUserResponse';

export async function searchUsers(filter: UserFilter): Promise<PagedUserResponse> {
    console.log("filter", filter);
    return await postData(`${process.env.API_BASE_URL}/Users/Search`, filter);
} 