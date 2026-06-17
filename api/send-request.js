import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    full_name,
    business_name,
    business_type,
    business_type_other,
    num_employees,
    num_locations,
    email,
    phone,
  } = req.body;

  // Validate required fields
  if (!full_name || !business_name || !business_type || !num_employees || !num_locations || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const resolvedBusinessType =
    business_type === 'Other' && business_type_other
      ? `Other: ${business_type_other}`
      : business_type;

  try {
    // 1. Insert into Supabase
    const { error: dbError } = await supabase.from('access_requests').insert({
      full_name,
      business_name,
      business_type: resolvedBusinessType,
      num_employees,
      num_locations,
      email,
      phone: phone || null,
    });

    if (dbError) {
      console.error('Supabase insert error:', dbError);
      return res.status(500).json({ error: 'Failed to save request' });
    }

    // Build send-setup link
    const setupParams = new URLSearchParams({
      name: full_name,
      business: business_name,
      email: email,
    });
    const setupLink = `https://usetmrw.com/send-setup?${setupParams.toString()}`;

    // 2. Notify daniel@usetmrw.com
    await resend.emails.send({
      from: 'TMRW <daniel@usetmrw.com>',
      to: 'daniel@usetmrw.com',
      subject: `New Access Request: ${business_name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2 style="margin-bottom: 24px;">New Access Request</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #eee;">Name</td><td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${full_name}</td></tr>
            <tr><td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #eee;">Business</td><td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${business_name}</td></tr>
            <tr><td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #eee;">Type</td><td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${resolvedBusinessType}</td></tr>
            <tr><td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #eee;">Employees</td><td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${num_employees}</td></tr>
            <tr><td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #eee;">Locations</td><td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${num_locations}</td></tr>
            <tr><td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #eee;">Email</td><td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${email}</td></tr>
            <tr><td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #eee;">Phone</td><td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${phone || '—'}</td></tr>
          </table>
          <div style="margin-top: 32px;">
            <a href="${setupLink}" style="display: inline-block; background: #F55C00; color: #fff; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-weight: 600;">Set Up This Customer</a>
          </div>
        </div>
      `,
    });

    // 3. Send confirmation to submitter
    const firstName = full_name.split(' ')[0];
    await resend.emails.send({
      from: 'Daniel from TMRW <daniel@usetmrw.com>',
      to: email,
      subject: "We got your request — you're on the list",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; line-height: 1.7;">
          <p>Hey ${firstName},</p>
          <p>Thanks for requesting access to TMRW. I got your submission and I'll be in touch within 24 hours to get you set up.</p>
          <p>In the meantime, if you have any questions, just reply to this email — it comes straight to me.</p>
          <p style="margin-top: 32px;">— Daniel<br><span style="color: #888; font-size: 14px;">Founder, TMRW</span></p>
        </div>
      `,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Request handler error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}
