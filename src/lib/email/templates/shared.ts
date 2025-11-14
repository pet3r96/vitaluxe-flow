/**
 * Shared Email Template Components
 * Reusable header, footer, and styles
 */

export const emailStyles = `
  body { 
    font-family: Arial, sans-serif; 
    line-height: 1.6; 
    color: #E2C977; 
    background-color: #0B0B0B; 
    margin: 0; 
    padding: 0; 
  }
  .container { 
    max-width: 600px; 
    margin: 0 auto; 
  }
  .header { 
    background: linear-gradient(135deg, #8E6E1E 0%, #C8A64B 50%, #E2C977 100%); 
    padding: 30px 20px; 
    text-align: center; 
  }
  .header h1 { 
    margin: 0; 
    color: #0B0B0B; 
    font-size: 28px; 
    font-weight: bold; 
    letter-spacing: 2px; 
  }
  .content { 
    background-color: #1A1A1A; 
    padding: 40px 30px; 
    border: 1px solid #292929; 
  }
  .content h2 { 
    color: #E2C977; 
    margin-top: 0; 
  }
  .content p { 
    color: #E2C977; 
  }
  .greeting { 
    color: #E2C977; 
    font-size: 16px; 
    margin-bottom: 20px; 
  }
  .button { 
    display: inline-block; 
    background-color: #C8A64B; 
    color: #0B0B0B; 
    padding: 14px 35px; 
    text-decoration: none; 
    border-radius: 6px; 
    margin: 25px 0; 
    font-weight: bold; 
  }
  .button:hover { 
    background-color: #E2C977; 
  }
  .footer { 
    text-align: center; 
    padding: 25px 20px; 
    color: #8E6E1E; 
    font-size: 12px; 
    background-color: #0B0B0B; 
  }
  .footer a { 
    color: #C8A64B; 
    text-decoration: none; 
  }
`;

export const emailHeader = `
  <div class="header">
    <h1>VITALUXE</h1>
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
