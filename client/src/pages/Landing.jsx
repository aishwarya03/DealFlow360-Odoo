import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Cable,
  CheckCircle2,
  ClipboardList,
  FileText,
  LifeBuoy,
  ScanFace,
  Video,
  Wrench,
} from 'lucide-react';

import Button from '../components/Button';
import ClientLogo from '../components/ClientLogo';
import LifecycleRing from '../components/LifecycleRing';
import Reveal from '../components/Reveal';

/*
 * This is Netrix Systems' own public site — the fictional demo tenant from
 * docs/DEMO_SCENARIO.md. DealFlow360 runs their sales operations behind the
 * scenes, the same way a company runs on Salesforce without putting
 * "Salesforce" on its own homepage. Nothing here should read as software
 * marketing, and nothing here should show internal workflow detail
 * (risk bands, approval routing) — that's staff- and portal-only, per
 * docs/SOURCE_OF_TRUTH.md §6.
 */

const categoryChips = [
  { icon: Video, label: 'Video Surveillance' },
  { icon: ScanFace, label: 'Access Control' },
  { icon: Cable, label: 'Installation' },
  { icon: LifeBuoy, label: 'AMC & Support' },
];

const services = [
  {
    icon: Video,
    title: 'Video surveillance',
    body: 'IP cameras and NVRs sized to your site, with cloud video storage and AI analytics — people counting, ANPR — for the locations that need it.',
  },
  {
    icon: ScanFace,
    title: 'Access control & attendance',
    body: 'ZKTeco biometric terminals and door controllers, wired into ZKBioTime cloud attendance and integrated with your payroll — one rollout, not two vendors.',
  },
  {
    icon: Wrench,
    title: 'Installation & cabling',
    body: 'Site survey, structured cabling and commissioning from certified technicians. Done once, done right — not a return visit six weeks later.',
  },
  {
    icon: LifeBuoy,
    title: 'AMC & support',
    body: 'Comprehensive annual maintenance and priority support, so systems keep running long after go-live — not just until the invoice clears.',
  },
];

/* A real company's own process, in plain language — no internal jargon. */
const stages = [
  {
    icon: ClipboardList,
    label: 'Survey',
    caption:
      'We visit your site and scope exactly what needs securing — cameras, doors, or both.',
  },
  {
    icon: FileText,
    label: 'Quote',
    caption:
      'You receive one clear, itemized quotation covering hardware, installation and AMC.',
  },
  {
    icon: CheckCircle2,
    label: 'Confirm',
    caption:
      'Review it and confirm online, at your pace — no back-and-forth over email.',
  },
  {
    icon: Wrench,
    label: 'Install',
    caption:
      'Certified technicians handle cabling, mounting and commissioning on schedule.',
  },
  {
    icon: LifeBuoy,
    label: 'Support',
    caption:
      'AMC and priority support keep it running — and the next site survey is just a call away.',
  },
];

const Landing = () => (
  <div className="min-h-screen bg-white">
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <ClientLogo />
        <div className="flex items-center gap-2">
          <Link to="/login">
            <Button variant="ghost" size="sm">
              Staff Login
            </Button>
          </Link>
          <Link to="/portal/login">
            <Button variant="secondary" size="sm">
              Customer Login
            </Button>
          </Link>
        </div>
      </div>
    </header>

    <section className="relative overflow-hidden border-b border-slate-200">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-48 h-96 bg-linear-to-b from-slate-100 to-transparent blur-3xl"
      />

      <div className="relative mx-auto max-w-6xl px-6 py-20 text-center sm:py-24">
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
          Bengaluru · Authorized ZKTeco Channel Partner
        </span>

        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance text-slate-900 sm:text-5xl">
          Security systems that protect what your business runs on.
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base text-pretty text-slate-600 sm:text-lg">
          CCTV, access control and biometric attendance — surveyed, installed
          and integrated end to end, with an AMC that keeps it running long
          after our technicians leave site.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a href="#contact">
            <Button size="lg">
              Request a Quote
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </a>
          <Link to="/portal/login">
            <Button size="lg" variant="secondary">
              Customer Login
            </Button>
          </Link>
        </div>

        <Reveal delay={150}>
          <div className="mx-auto mt-14 flex max-w-2xl flex-wrap items-center justify-center gap-3">
            {categoryChips.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm text-slate-600"
              >
                <Icon className="size-4 text-slate-400" aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>

    <section className="mx-auto max-w-6xl px-6 py-20">
      <Reveal className="max-w-2xl">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          What we install and support
        </h2>
        <p className="mt-3 text-slate-600">
          One integrator for the hardware, the install, and everything after.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {services.map(({ icon: Icon, title, body }, index) => (
          <Reveal key={title} delay={index * 80}>
            <div className="h-full rounded-lg border border-slate-200 bg-white p-6">
              <span className="inline-flex size-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>

    <section className="border-y border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <Reveal className="text-center">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            How we work
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            From site survey to signed-off install
          </h2>
        </Reveal>

        <Reveal delay={100}>
          <LifecycleRing stages={stages} className="mt-10" />
        </Reveal>
      </div>
    </section>

    <section id="contact" className="mx-auto max-w-6xl px-6 py-20">
      <Reveal className="grid gap-5 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="text-base font-semibold text-slate-900">
            Existing customer?
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            View your live quotation, track fulfillment, and negotiate terms
            directly — no email thread required.
          </p>
          <Link to="/portal/login" className="mt-4 inline-block">
            <Button variant="secondary">Log in to your portal</Button>
          </Link>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="text-base font-semibold text-slate-900">
            New to Netrix?
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Tell us what you need secured and we&apos;ll schedule a site
            survey — sales@netrixsystems.example
          </p>
          <a href="mailto:sales@netrixsystems.example" className="mt-4 inline-block">
            <Button>Request a Quote</Button>
          </a>
        </div>
      </Reveal>
    </section>

    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8">
        <div>
          <ClientLogo />
          <p className="mt-1.5 text-xs text-slate-500">Bengaluru, Karnataka</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <Link to="/login" className="hover:text-slate-600">
            Staff Login
          </Link>
          <span>Powered by DealFlow360</span>
        </div>
      </div>
    </footer>
  </div>
);

export default Landing;
