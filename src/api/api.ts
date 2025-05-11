/**
 * API utility functions for making web requests
 */

/**
 * Fetch data from an API endpoint
 * @param url The API endpoint URL
 * @param options Optional fetch options
 * @returns Promise with the response data
 */
export async function fetchData(url: string, options?: RequestInit): Promise<any> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      ...options
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
}

/**
 * Post data to an API endpoint
 * @param url The API endpoint URL
 * @param data The data to send
 * @param options Optional fetch options
 * @returns Promise with the response data
 */
export async function postData(url: string, data: any, options?: RequestInit): Promise<any> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      ...options
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
} 