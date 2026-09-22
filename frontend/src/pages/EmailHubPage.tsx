import React, { useState } from 'react';
import { Inbox, Send } from 'lucide-react';
import { EmailBookingWorkflowPage } from './EmailBookingWorkflowPage';
import { EmailCommunicationsHubPage } from './EmailCommunicationsHubPage';

/**
 * One Email section with two tabs, so all email work lives in a single place:
 *  - Inbox & Enquiries: the connected mailboxes (IMAP), replies, AI drafts and
 *    turning an enquiry into a booking.
 *  - Sent & Templates: the outbound dispatch log, compose, templates and the
 *    SMTP/automation config.
 * The two are independent (different endpoints), so nothing conflicts.
 */
export const EmailHubPage: React.FC = () => {
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox');

  const TabBtn: React.FC<{ id: 'inbox' | 'sent'; icon: React.ReactNode; label: string }> = ({ id, icon, label }) => (
    <button
      onClick={() => setTab(id)}
      className={`px-4 py-2 rounded-xl text-xs font-black border transition-all flex items-center gap-2 ${
        tab === id
          ? 'bg-[#06090F] text-white border-[#DFCAA8] shadow-md'
          : 'bg-[#FFFFFF] text-[#0A0E1A] border-[#E6D8C3] hover:bg-[#FAF6F0]'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <TabBtn id="inbox" icon={<Inbox className="w-3.5 h-3.5" />} label="Inbox & Enquiries" />
        <TabBtn id="sent" icon={<Send className="w-3.5 h-3.5" />} label="Sent, Templates & Config" />
      </div>

      {tab === 'inbox' ? <EmailBookingWorkflowPage /> : <EmailCommunicationsHubPage />}
    </div>
  );
};
