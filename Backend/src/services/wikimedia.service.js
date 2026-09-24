export class WikimediaService {
    constructor() {
        this.baseUrl = 'https://api.enterprise.wikimedia.com/v2';
        this.authUrl = 'https://auth.enterprise.wikimedia.com/v1/login';
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    async authenticate(username, password) {
        // If we already have a valid token, don't re-authenticate
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        try {
            const response = await fetch(this.authUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                throw new Error(`Wikimedia Auth failed: ${response.statusText}`);
            }

            const data = await response.json();
            this.accessToken = data.access_token;
            // Token expires in 86400 seconds (24 hours). 
            // We set expiry slightly earlier to be safe.
            this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000; 

            return this.accessToken;
        } catch (error) {
            console.error('Error authenticating with Wikimedia:', error);
            throw error;
        }
    }

    async getArticle(projectName, articleTitle, env) {
        const token = await this.authenticate(env.WIKIMEDIA_USERNAME, env.WIKIMEDIA_PASSWORD);
        
        // Use the On-Demand API endpoint for fetching a specific article
        // We POST to /v2/articles/{name} and pass the project in the filters
        const url = `${this.baseUrl}/articles/${encodeURIComponent(articleTitle)}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filters: [
                    {
                        field: "is_part_of.identifier",
                        value: projectName
                    }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch article ${articleTitle}: ${response.statusText}`);
        }

        const data = await response.json();
        // The API returns an array of matching articles
        if (!data || data.length === 0) {
             throw new Error(`Article ${articleTitle} not found in ${projectName}`);
        }
        return data[0];
    }

    // This parses the massive Wikimedia response into our clean D1 Schema format
    parseWikivoyageArticle(articleData) {
        // 1. Extract the core destination details
        const destination = {
            name: articleData.name,
            slug: articleData.name.toLowerCase().replace(/\s+/g, '-'),
            description: articleData.abstract || '',
        };

        // 2. Extract sections (See, Do, Eat, Sleep) if using Structured Contents
        // In the NDJSON snapshot or on-demand structured response, these are usually
        // inside an array of 'sections' or 'article_body'.
        const sections = {};
        if (articleData.article_body && articleData.article_body.html) {
             // In a real implementation, you would parse the structured JSON sections here
             // e.g. mapping "See" to sections.see
             sections.rawHtml = articleData.article_body.html; 
        }

        return { destination, sections };
    }
}

export const wikimediaService = new WikimediaService();
