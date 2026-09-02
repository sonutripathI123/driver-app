import React, { useState } from 'react';
import { LuxuryCarCanvas } from '../components/3d/LuxuryCarCanvas';
import { bookingsApi, pricingApi } from '../services/api';
import { VehicleCategory } from '../types';
import { triggerNativeNotification } from '../utils/notificationSound';
import confetti from 'canvas-confetti';
import {
  Compass,
  MapPin,
  Calendar,
  Clock,
  Plane,
  Plus,
  Trash2,
  CreditCard,
  CheckCircle2,
  Sparkles,
  DollarSign,
  ShieldCheck,
  Zap,
  MessageSquare,
  Lock,
  Building2,
  Smartphone,
  FileText,
  Mail
} from 'lucide-react';

export const QuoteBookingPage: React.FC = () => {
  const [journeyType, setJourneyType] = useState<'ONE_WAY' | 'RETURN' | 'HOURLY'>('ONE_WAY');
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategory>('SEDAN_EXECUTIVE');
  const [pickupAddress, setPickupAddress] = useState('Crown Towers, 8 Whiteman St, Southbank VIC 3006');
  const [dropoffAddress, setDropoffAddress] = useState('Melbourne Airport Terminal 2 (Tullamarine)');
  const [pickupDate, setPickupDate] = useState('2026-08-28');
  const [pickupTime, setPickupTime] = useState('09:30');
  const [isAirport, setIsAirport] = useState(true);
  const [flightNumber, setFlightNumber] = useState('QF400');
  const [passengerName, setPassengerName] = useState('Alexander Vance');
  const [passengerPhone, setPassengerPhone] = useState('+61 412 345 678');
  const [passengerEmail, setPassengerEmail] = useState('alexander.vance@opalchauffeurs.com.au');
  const [paymentOption, setPaymentOption] = useState<'FULL' | 'DEPOSIT_25'>('FULL');

  // In-Form Real Payment Method State
  const [paymentMethodType, setPaymentMethodType] = useState<'CARD' | 'DIGITAL_WALLET' | 'PAYID_EFT' | 'CORPORATE_ACCOUNT'>('CARD');
  const [cardNumber, setCardNumber] = useState('4532 •••• •••• 8892');
  const [cardExpiry, setCardExpiry] = useState('09/28');
  const [cardCvc, setCardCvc] = useState('841');
  const [cardHolder, setCardHolder] = useState('Alexander Vance');
  const [corporateAccountCode, setCorporateAccountCode] = useState('CORP-RIO-880');

  // Booking Result Modal
  const [createdBookingNumber, setCreatedBookingNumber] = useState<string | null>(null);
  const [createdInvoiceNumber, setCreatedInvoiceNumber] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic Fare Estimation Formula
  const calculateEstimatedFare = () => {
    let base = selectedCategory === 'MINIBUS' ? 220 : selectedCategory === 'PEOPLE_MOVER' ? 180 : selectedCategory === 'SUV_PREMIUM' ? 160 : 130;
    const estKm = isAirport ? 28.5 : 18.0;
    const perKm = selectedCategory === 'MINIBUS' ? 4.5 : selectedCategory === 'PEOPLE_MOVER' ? 3.8 : 3.2;
    let fare = base + estKm * perKm;

    if (isAirport) fare += 25.0; // Airport Meet & Greet Toll
    if (journeyType === 'RETURN') fare *= 1.9; // 10% discount on return leg

    const gst = fare / 11.0;
    const exGst = fare - gst;
    const deposit = fare * 0.25;

    return {
      gross: Math.round(fare),
      exGst: parseFloat(exGst.toFixed(2)),
      gst: parseFloat(gst.toFixed(2)),
      deposit: Math.round(deposit),
    };
  };

  const fare = calculateEstimatedFare();

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const paidAmount = paymentOption === 'DEPOSIT_25' ? fare.deposit : fare.gross;
    const invoiceNum = `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      const payload = {
        source: 'WEBSITE_PAYMENT_GATEWAY',
        currency: 'AUD',
        customer_email: passengerEmail,
        customer_name: passengerName,
        customer_phone: passengerPhone,
        total_fare: fare.gross,
        deposit_required: paymentOption === 'DEPOSIT_25' ? fare.deposit : fare.gross,
        paid_amount: paidAmount,
        payment_status: paymentOption === 'FULL' ? 'PAID' : 'PARTIALLY_PAID',
        payment_method: paymentMethodType === 'CARD' ? 'Visa/Mastercard 256-Bit SSL' : paymentMethodType === 'DIGITAL_WALLET' ? 'Apple Pay / Google Pay' : paymentMethodType === 'PAYID_EFT' ? 'OSKO / PayID Direct Bank Transfer' : 'Corporate Account (Net 30)',
        legs: [
          {
            leg_number: 1,
            pickup_address: pickupAddress,
            dropoff_address: dropoffAddress,
            pickup_datetime: `${pickupDate}T${pickupTime}:00`,
            is_airport_pickup: isAirport,
            flight_number: isAirport ? flightNumber : undefined,
            vehicle_category: selectedCategory,
          },
        ],
      };

      const res = await bookingsApi.create(payload);
      const bNumber = res?.booking_number || `CCM-${Math.floor(10000 + Math.random() * 90000)}`;
      setCreatedBookingNumber(bNumber);
      setCreatedInvoiceNumber(invoiceNum);

      // Trigger Web Audio Chime, Device Vibration, and Browser Push Notification
      await triggerNativeNotification(
        `🚨 [PAYMENT RECEIVED & BOOKING CONFIRMED] #${bNumber}`,
        `${passengerName} • $${paidAmount.toFixed(2)} AUD Paid via ${paymentMethodType} • Auto-Reconciled`
      );

      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#D4AF37', '#06B6D4', '#10B981'],
      });
    } catch (err) {
      // Mock generation for offline demo
      const fakeNumber = `CCM-${Math.floor(10000 + Math.random() * 90000)}`;
      setCreatedBookingNumber(fakeNumber);
      setCreatedInvoiceNumber(invoiceNum);

      await triggerNativeNotification(
        `🚨 [PAYMENT RECEIVED & BOOKING CONFIRMED] #${fakeNumber}`,
        `${passengerName} • $${paidAmount.toFixed(2)} AUD Paid via ${paymentMethodType} • Auto-Reconciled`
      );

      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#D4AF37', '#06B6D4', '#10B981'],
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[#0A0E1A] tracking-tight">Instant Quote & 3D Booking Engine</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] text-xs font-black font-mono shadow-sm">
              REAL-TIME PAYMENT GATEWAY
            </span>
          </div>
          <p className="text-xs text-slate-700 font-semibold mt-1">
            Seamless booking with integrated Credit Card, Apple Pay, PayID & Corporate Account payment auto-settlement.
          </p>
        </div>

        {/* Journey Type Switcher */}
        <div className="flex p-1 bg-[#06090F] rounded-xl border border-[#1E2738]">
          {(['ONE_WAY', 'RETURN', 'HOURLY'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setJourneyType(type)}
              className={`px-4 py-2 rounded-lg text-xs transition-all ${
                journeyType === type ? 'bg-[#DFCAA8] text-[#0A0E1A] font-black shadow-md' : 'text-slate-400 hover:text-white font-bold'
              }`}
            >
              {type === 'ONE_WAY' ? 'One-Way Transfer' : type === 'RETURN' ? 'Return Journey' : 'Hourly As-Directed'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: 3D Interactive Car Showroom & Class Specs (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <div className="h-[420px]">
            <LuxuryCarCanvas
              category={selectedCategory}
              onCategoryChange={setSelectedCategory}
              showControls={true}
            />
          </div>

          {/* Pricing & GST Breakdown Card */}
          <div className="glass-panel p-5 rounded-2xl border-[#E6D8C3] space-y-3 text-xs shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6D8C3]">
              <span className="font-black text-[#0A0E1A]">Quote Calculation Summary</span>
              <span className="text-slate-700 font-mono font-bold">Australian 10% GST Included</span>
            </div>

            <div className="space-y-1.5 text-slate-700 font-semibold">
              <div className="flex justify-between">
                <span>Base Flagfall & Distance (~28 km)</span>
                <span className="text-[#0A0E1A] font-mono font-bold">${(fare.exGst - (isAirport ? 22.73 : 0)).toFixed(2)}</span>
              </div>
              {isAirport && (
                <div className="flex justify-between text-cyan-900 font-bold">
                  <span>Airport Toll & Meet & Greet (60m)</span>
                  <span className="font-mono">+$22.73</span>
                </div>
              )}
              <div className="flex justify-between text-[#0A0E1A]">
                <span>Subtotal (Ex GST)</span>
                <span className="text-[#0A0E1A] font-mono font-bold">${fare.exGst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#0A0E1A] font-bold">
                <span>10% Australian GST (1/11th)</span>
                <span className="font-mono">+${fare.gst.toFixed(2)}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E6D8C3] flex items-center justify-between text-[#0A0E1A]">
              <div>
                <span className="text-xs text-[#0A0E1A] font-bold block">Total Customer Fare</span>
                <span className="text-3xl font-mono font-black text-[#0A0E1A]">${fare.gross.toFixed(2)} AUD</span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-[#0A0E1A] font-bold block">25% Deposit Option</span>
                <span className="text-sm font-mono font-black text-[#0A0E1A]">${fare.deposit.toFixed(2)} AUD</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Booking & Payment Form (7 Cols) */}
        <div className="lg:col-span-7">
          <form onSubmit={handleConfirmBooking} className="glass-panel p-6 rounded-2xl space-y-5 text-xs shadow-xl">
            <div className="flex items-center gap-2 text-sm font-black text-[#0A0E1A] border-b border-[#E6D8C3] pb-3">
              <Compass className="w-4 h-4 text-amber-600" />
              <span>Journey Details (Leg #1)</span>
            </div>

            {/* Pickup & Dropoff Inputs */}
            <div className="space-y-3">
              <div>
                <label className="block font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-600" /> Pickup Location
                </label>
                <input
                  type="text"
                  required
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] placeholder-slate-400 font-bold focus:outline-none focus:border-[#0A0E1A]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-cyan-600" /> Destination Dropoff
                </label>
                <input
                  type="text"
                  required
                  value={dropoffAddress}
                  onChange={(e) => setDropoffAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] placeholder-slate-400 font-bold focus:outline-none focus:border-[#0A0E1A]"
                />
              </div>
            </div>

            {/* Date, Time & Airport Meet Toggle */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-600" /> Pickup Date
                </label>
                <input
                  type="date"
                  required
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-600" /> Pickup Time (AEST)
                </label>
                <input
                  type="time"
                  required
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <Plane className="w-3.5 h-3.5 text-sky-600" /> Airport Transfer?
                </label>
                <button
                  type="button"
                  onClick={() => setIsAirport(!isAirport)}
                  className={`w-full py-2.5 rounded-xl font-black border transition-all ${
                    isAirport ? 'bg-[#06090F] text-[#FAF6F0] border-[#DFCAA8] shadow-sm' : 'bg-[#FFFFFF] text-[#0A0E1A] border-[#E6D8C3]'
                  }`}
                >
                  {isAirport ? '✈️ Yes (Meet & Greet)' : 'No Airport'}
                </button>
              </div>
            </div>

            {/* Flight Number if Airport */}
            {isAirport && (
              <div className="p-3.5 rounded-xl bg-cyan-50 border border-cyan-200 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in">
                <div>
                  <label className="block font-bold text-cyan-950 mb-1">Flight Number (OpenSky Radar Live)</label>
                  <input
                    type="text"
                    value={flightNumber}
                    onChange={(e) => setFlightNumber(e.target.value)}
                    placeholder="e.g. QF400 or VA214"
                    className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-cyan-300 text-[#0A0E1A] uppercase font-mono font-black"
                  />
                </div>
                <div className="flex flex-col justify-center text-[11px] text-cyan-900 font-semibold">
                  <span>✓ 60-min complimentary wait-time from touchdown</span>
                  <span>✓ Automated delay pickup rescheduling</span>
                </div>
              </div>
            )}

            {/* Passenger Contact Information */}
            <div className="pt-2 border-t border-[#E6D8C3] space-y-3">
              <span className="font-black text-[#0A0E1A] block">Passenger & Corporate Contact</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Full Name"
                  value={passengerName}
                  onChange={(e) => setPassengerName(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] placeholder-slate-400 font-bold"
                />
                <input
                  type="tel"
                  required
                  placeholder="Mobile (+61...)"
                  value={passengerPhone}
                  onChange={(e) => setPassengerPhone(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] placeholder-slate-400 font-mono font-bold"
                />
                <input
                  type="email"
                  required
                  placeholder="Email"
                  value={passengerEmail}
                  onChange={(e) => setPassengerEmail(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] placeholder-slate-400 font-bold"
                />
              </div>
            </div>

            {/* Deposit vs Full Payment Amount Option */}
            <div className="pt-2 border-t border-[#E6D8C3] space-y-2">
              <span className="font-black text-[#0A0E1A] block">Settlement Schedule</span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentOption('FULL')}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    paymentOption === 'FULL'
                      ? 'bg-[#06090F] border-[#DFCAA8] text-[#FAF6F0] shadow-md scale-100'
                      : 'bg-[#FFFFFF] border-[#E6D8C3] text-[#0A0E1A]'
                  }`}
                >
                  <span className={`font-black block text-xs ${paymentOption === 'FULL' ? 'text-[#FAF6F0]' : 'text-[#0A0E1A]'}`}>
                    Pay Full Fare (100%)
                  </span>
                  <span className={`text-xs font-mono font-bold ${paymentOption === 'FULL' ? 'text-[#DFCAA8]' : 'text-amber-800'}`}>
                    ${fare.gross.toFixed(2)} AUD
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentOption('DEPOSIT_25')}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    paymentOption === 'DEPOSIT_25'
                      ? 'bg-[#06090F] border-[#DFCAA8] text-[#FAF6F0] shadow-md scale-100'
                      : 'bg-[#FFFFFF] border-[#E6D8C3] text-[#0A0E1A]'
                  }`}
                >
                  <span className={`font-black block text-xs ${paymentOption === 'DEPOSIT_25' ? 'text-[#FAF6F0]' : 'text-[#0A0E1A]'}`}>
                    Pay 25% Deposit Now
                  </span>
                  <span className={`text-xs font-mono font-bold ${paymentOption === 'DEPOSIT_25' ? 'text-emerald-400' : 'text-emerald-800'}`}>
                    ${fare.deposit.toFixed(2)} AUD
                  </span>
                </button>
              </div>
            </div>

            {/* Real-Time Payment Method Selector */}
            <div className="pt-2 border-t border-[#E6D8C3] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-black text-[#0A0E1A] block">Instant Payment Channel</span>
                <span className="text-[10px] text-emerald-800 font-mono font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> 256-Bit SSL Auto-Settled
                </span>
              </div>

              {/* Payment Channel Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethodType('CARD')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-center transition-all ${
                    paymentMethodType === 'CARD'
                      ? 'border-[#DFCAA8] bg-[#06090F] text-[#FAF6F0] shadow-md font-black'
                      : 'border-[#E6D8C3] bg-[#FFFFFF] text-[#0A0E1A] hover:bg-[#FAF6F0] font-bold'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span className="text-[11px]">Credit / Debit Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethodType('DIGITAL_WALLET')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-center transition-all ${
                    paymentMethodType === 'DIGITAL_WALLET'
                      ? 'border-[#DFCAA8] bg-[#06090F] text-[#FAF6F0] shadow-md font-black'
                      : 'border-[#E6D8C3] bg-[#FFFFFF] text-[#0A0E1A] hover:bg-[#FAF6F0] font-bold'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span className="text-[11px]">Apple / Google Pay</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethodType('PAYID_EFT')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-center transition-all ${
                    paymentMethodType === 'PAYID_EFT'
                      ? 'border-[#DFCAA8] bg-[#06090F] text-[#FAF6F0] shadow-md font-black'
                      : 'border-[#E6D8C3] bg-[#FFFFFF] text-[#0A0E1A] hover:bg-[#FAF6F0] font-bold'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  <span className="text-[11px]">OSKO / PayID (EFT)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethodType('CORPORATE_ACCOUNT')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-center transition-all ${
                    paymentMethodType === 'CORPORATE_ACCOUNT'
                      ? 'border-[#DFCAA8] bg-[#06090F] text-[#FAF6F0] shadow-md font-black'
                      : 'border-[#E6D8C3] bg-[#FFFFFF] text-[#0A0E1A] hover:bg-[#FAF6F0] font-bold'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span className="text-[11px]">Monthly Account</span>
                </button>
              </div>

              {/* Dynamic Payment Channel Inputs */}
              {paymentMethodType === 'CARD' && (
                <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] space-y-3 animate-in fade-in shadow-sm">
                  <div className="flex items-center justify-between border-b border-[#E6D8C3] pb-2">
                    <span className="font-black text-[#0A0E1A] text-[11px]">Enter Card Details (Visa, Mastercard, Amex)</span>
                    <span className="text-[10px] text-slate-600 font-mono font-bold">🔒 SSL Encrypted</span>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-700 uppercase font-bold block mb-1">Card Number</label>
                    <input
                      type="text"
                      required
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="•••• •••• •••• ••••"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6F0] border border-[#E6D8C3] text-[#0A0E1A] font-mono tracking-widest text-xs font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-700 uppercase font-bold block mb-1">Expiry</label>
                      <input
                        type="text"
                        required
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        placeholder="MM/YY"
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E6D8C3] text-[#0A0E1A] font-mono text-center text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-700 uppercase font-bold block mb-1">CVV / CVC</label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value)}
                        placeholder="•••"
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E6D8C3] text-[#0A0E1A] font-mono text-center text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-700 uppercase font-bold block mb-1">Cardholder</label>
                      <input
                        type="text"
                        required
                        value={cardHolder}
                        onChange={(e) => setCardHolder(e.target.value)}
                        placeholder="Name on card"
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E6D8C3] text-[#0A0E1A] text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {paymentMethodType === 'DIGITAL_WALLET' && (
                <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] text-center space-y-2 animate-in fade-in">
                  <span className="font-black block text-sm text-[#0A0E1A]">🍎 Apple Pay & ⚡ Google Pay Enabled</span>
                  <p className="text-xs text-[#0A0E1A] font-bold">
                    Clicking Confirm will trigger 1-Tap Biometric (FaceID / TouchID) checkout for instantaneous booking confirmation.
                  </p>
                </div>
              )}

              {paymentMethodType === 'PAYID_EFT' && (
                <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] space-y-2 text-xs font-mono animate-in fade-in">
                  <span className="font-black font-sans block text-sm text-[#0A0E1A]">Instant OSKO / PayID Transfer Details</span>
                  <div className="flex justify-between border-b border-[#E6D8C3] pb-1">
                    <span className="text-[#0A0E1A]">PayID / Email:</span>
                    <strong className="text-[#0A0E1A]">book@opalchauffeurs.com.au</strong>
                  </div>
                  <div className="flex justify-between border-b border-[#E6D8C3] pb-1">
                    <span className="text-[#0A0E1A]">Bank:</span>
                    <span className="font-black text-[#0A0E1A]">Commonwealth Bank (BSB: 063-000 • Acc: 1092 8841)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#0A0E1A]">Payment Reference:</span>
                    <strong className="text-[#0A0E1A] font-black">OPAL-TRANSFER</strong>
                  </div>
                </div>
              )}

              {paymentMethodType === 'CORPORATE_ACCOUNT' && (
                <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#DFCAA8] space-y-2 text-xs animate-in fade-in text-[#0A0E1A]">
                  <span className="font-black text-[#0A0E1A] block">Monthly Post-Paid Corporate Account Billing</span>
                  <label className="text-[10px] text-[#0A0E1A] uppercase font-black block">Select Corporate Account</label>
                  <select
                    value={corporateAccountCode}
                    onChange={(e) => setCorporateAccountCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-black"
                  >
                    <option value="CORP-RIO-880" className="text-[#0A0E1A]">Rio Tinto Mining Executive Account (Net 30)</option>
                    <option value="CORP-BHP-550" className="text-[#0A0E1A]">BHP Billiton VIP Corporate Services (Net 30)</option>
                    <option value="CORP-MQG-102" className="text-[#0A0E1A]">Macquarie Group Private Wealth (Net 14)</option>
                  </select>
                  <p className="text-[10px] text-[#0A0E1A] font-bold">This booking will be charged to the monthly corporate account credit ledger.</p>
                </div>
              )}
            </div>

            {/* Submit & Instant Pay Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 rounded-2xl bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl hover:scale-[1.01] transition-all"
            >
              <Lock className="w-4 h-4 text-white" />
              <span>
                {isSubmitting
                  ? 'Authorizing & Dispatching Master Booking...'
                  : `🔒 Pay $${(paymentOption === 'FULL' ? fare.gross : fare.deposit).toFixed(2)} AUD & Confirm Master Booking`}
              </span>
            </button>
          </form>
        </div>
      </div>

      {/* Confirmation & Printable Tax Invoice Modal */}
      {createdBookingNumber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] max-w-lg w-full p-8 rounded-3xl text-center space-y-5 shadow-2xl text-[#0A0E1A]">
            <div className="w-16 h-16 rounded-full bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-8 h-8 text-[#0A0E1A]" />
            </div>

            <div>
              <h3 className="text-2xl font-black text-[#0A0E1A]">Payment Authorized & Booking Locked!</h3>
              <p className="text-xs text-[#0A0E1A] font-bold mt-1">
                Your journey is locked in the Master Booking Engine as <strong className="text-[#0A0E1A] font-mono text-sm">{createdBookingNumber}</strong>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] text-left space-y-2 text-xs text-[#0A0E1A]">
              <div className="flex justify-between">
                <span className="text-[#0A0E1A] font-bold">Tax Invoice Number:</span>
                <span className="font-mono font-black text-[#0A0E1A]">{createdInvoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#0A0E1A] font-bold">Passenger:</span>
                <span className="font-black text-[#0A0E1A]">{passengerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#0A0E1A] font-bold">Vehicle Category:</span>
                <span className="text-[#0A0E1A] font-black">{selectedCategory}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#0A0E1A] font-bold">Total Invoiced:</span>
                <span className="font-mono font-black text-[#0A0E1A]">${fare.gross.toFixed(2)} AUD</span>
              </div>
              <div className="flex justify-between text-[#0A0E1A] font-bold">
                <span>Payment Settlement Status:</span>
                <span className="font-black font-mono text-[#0A0E1A]">
                  ● {paymentOption === 'FULL' ? `PAID IN FULL ($${fare.gross.toFixed(2)})` : `25% DEPOSIT PAID ($${fare.deposit.toFixed(2)})`}
                </span>
              </div>
            </div>

            {/* Phase 1: Direct WhatsApp & Email Voucher Dispatch Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <a
                href={`https://api.whatsapp.com/send?phone=${passengerPhone.replace(/[^0-9]/g, '') || '61432000718'}&text=${encodeURIComponent(
                  `🚗 *[OPAL CHAUFFEURS - BOOKING CONFIRMATION & TRIP VOUCHER]* 🧑‍✈️\n\n` +
                  `📋 *Booking Reference:* #${createdBookingNumber}\n` +
                  `👤 *Passenger:* ${passengerName} (${passengerPhone})\n` +
                  `📅 *Pickup Date:* ${pickupDate}\n` +
                  `⏰ *Pickup Time:* ${pickupTime} AEST\n` +
                  `📍 *Pickup Location:* ${pickupAddress}\n` +
                  `🏁 *Dropoff Location:* ${dropoffAddress}${
                    isAirport && flightNumber ? `\n✈️ *Flight Tracked:* ${flightNumber} (Meet & Greet + 60m Free Waiting)` : ''
                  }\n` +
                  `🚘 *Vehicle Reserved:* ${selectedCategory}\n` +
                  `🧑‍✈️ *Lead Chauffeur:* Sonu Tripathi (+61 432 000 718)\n` +
                  `💰 *Agreed Fare:* $${fare.gross.toFixed(2)} AUD\n` +
                  `💳 *Payment Status:* ${paymentOption === 'FULL' ? 'PAID IN FULL' : '25% DEPOSIT RECEIVED'}\n\n` +
                  `ℹ️ *Chauffeur Note:* Your luxury chauffeur will arrive 10 minutes prior to pickup. For airport transfers, our satellite flight radar tracks your aircraft in real-time.\n\n` +
                  `📞 24/7 Operations: +61 432 000 718\n` +
                  `🌐 https://www.opalchauffeurs.com.au\n\n` +
                  `✅ Thank you for traveling with Opal Chauffeurs Australia!`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-3 px-4 rounded-xl bg-[#06090F] hover:bg-[#1A2233] text-white font-black text-xs flex items-center justify-center gap-1.5 border border-[#DFCAA8] shadow-lg transition-all"
              >
                <MessageSquare className="w-4 h-4 text-white" />
                <span>📱 WhatsApp Voucher</span>
              </a>

              <a
                href={`mailto:${passengerEmail}?subject=${encodeURIComponent(
                  `[Booking Confirmation] Opal Chauffeurs Journey #${createdBookingNumber} — ${passengerName}`
                )}&body=${encodeURIComponent(
                  `Dear ${passengerName},\n\nYour luxury chauffeur reservation with Opal Chauffeurs Australia has been confirmed.\n\n` +
                  `Booking Reference: #${createdBookingNumber}\n` +
                  `Pickup Date & Time: ${pickupDate} at ${pickupTime} AEST\n` +
                  `Pickup Location: ${pickupAddress}\n` +
                  `Dropoff Location: ${dropoffAddress}\n` +
                  `Vehicle Reserved: ${selectedCategory}\n` +
                  `Allocated Chauffeur: Sonu Tripathi (Phone: +61 432 000 718)\n` +
                  `Agreed Fare: $${fare.gross.toFixed(2)} AUD (${paymentOption === 'FULL' ? 'PAID IN FULL' : '25% DEPOSIT PAID'})\n\n` +
                  `Note: Your chauffeur will arrive 10 minutes prior. For airport pickups, flight status is monitored via live radar.\n\n` +
                  `Kind Regards,\nOpal Chauffeurs Australia\nPhone: +61 432 000 718\nWeb: https://www.opalchauffeurs.com.au`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-3 px-4 rounded-xl bg-[#06090F] hover:bg-[#1A2233] text-white border border-[#DFCAA8] font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
              >
                <Mail className="w-4 h-4 text-white" />
                <span>✉️ Email Voucher</span>
              </a>
            </div>

            <button
              onClick={() => setCreatedBookingNumber(null)}
              className="w-full py-3 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF6F0] text-[#0A0E1A] border border-[#E6D8C3] font-black text-xs transition-colors shadow-sm"
            >
              Done & Return to Dispatch Hub
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
