/**
 * Shared Email Template Components
 * Reusable header, footer, and styles
 */

export const emailStyles = `
  body { 
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
    line-height: 1.6; 
    color: #E2C977; 
    background-color: #0B0B0B; 
    margin: 0; 
    padding: 0; 
  }
  .container { 
    max-width: 600px; 
    margin: 0 auto; 
    background-color: #0B0B0B;
  }
  .header { 
    background-color: #0B0B0B;
    padding: 40px 20px; 
    text-align: center; 
    border-bottom: 1px solid #292929;
  }
  .logo {
    height: 80px;
    width: auto;
    max-width: 300px;
    margin: 0 auto;
    display: block;
  }
  .content { 
    background-color: #1A1A1A; 
    padding: 40px 30px; 
    border: none;
  }
  .content h2 { 
    color: #E2C977; 
    margin-top: 0;
    font-size: 24px;
    font-weight: 600;
    margin-bottom: 20px;
  }
  .content p { 
    color: #E2C977;
    font-size: 15px;
    line-height: 1.7;
    margin: 16px 0;
  }
  .greeting { 
    color: #E2C977; 
    font-size: 16px; 
    margin-bottom: 24px;
    font-weight: 500;
  }
  .button { 
    display: inline-block; 
    background-color: #C8A64B; 
    color: #0B0B0B; 
    padding: 14px 35px; 
    text-decoration: none; 
    border-radius: 6px; 
    margin: 25px 0; 
    font-weight: 600;
    font-size: 15px;
    transition: background-color 0.2s ease;
  }
  .button:hover { 
    background-color: #E2C977; 
  }
  .footer { 
    text-align: center; 
    padding: 30px 20px; 
    color: #8E6E1E; 
    font-size: 13px; 
    background-color: #0B0B0B;
    border-top: 1px solid #292929;
  }
  .footer a { 
    color: #C8A64B; 
    text-decoration: none; 
  }
  .footer a:hover {
    color: #E2C977;
  }
`;

export const emailHeader = `
  <div class="header">
    <img 
      src="https://app.vitaluxeservices.com/images/vitaluxe-logo.png" 
      alt="Vitaluxe Services" 
      class="logo"
    />
  </div>
`;

export const emailFooter = `
  <div class="footer">
    <p>&copy; ${new Date().getFullYear()} Vitaluxe Services. All rights reserved.</p>
    <p>
      <a href="https://app.vitaluxeservices.com">Visit Portal</a> | 
      <a href="https://app.vitaluxeservices.com/support">Support</a>
    </p>
  </div>
`;

export function wrapEmailTemplate(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        ${emailStyles}
      </style>
    </head>
    <body>
      <div class="container">
        ${emailHeader}
        ${content}
        ${emailFooter}
      </div>
    </body>
    </html>
  `;
}

export function createTextVersion(htmlContent: string): string {
  // Strip HTML tags and convert to plain text
  return htmlContent
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}
