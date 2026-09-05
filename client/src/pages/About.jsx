import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  MapPin,
  ShieldCheck,
  UsersRound,
  Wrench,
} from 'lucide-react';

import Button from '../components/Button';
import Reveal from '../components/Reveal';
import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';
import { NETRIX_TAG, useBrandTag } from '../hooks/useBrandTag';

const values = [
  {
    icon: ShieldCheck,
    title: 'One integrator, not a chain of vendors',
    body: 'Cameras, access control, cabling and AMC from a single point of contact — one quotation, one install team, one number to call after go-live.',
  },
  {
    icon: Wrench,
    title: 'Certified, in-house technicians',
    body: 'We don’t subcontract the install. The people who survey your site are the people who commission it.',
  },
  {
    icon: Award,
    title: 'Authorized ZKTeco channel partner',
    body: 'Genuine hardware, proper licensing, and direct access to ZKTeco support when it matters.',
  },
  {
    icon: UsersRound,
    title: 'Built for how SMEs actually buy',
    body: 'Clear itemized quotes, honest timelines, and an AMC that means your systems are still someone’s job a year after installation.',
  },
];

const About = () => {
  useBrandTag(`About · ${NETRIX_TAG.title}`, NETRIX_TAG.icon);

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
            <MapPin className="size-3.5" aria-hidden="true" />
            Bengaluru, Karnataka
          </span>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Security systems, installed properly.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-slate-600">
            Netrix Systems is a Bengaluru-based security and surveillance
            integrator. We design, install and support CCTV, access control
            and biometric attendance systems for offices, factories and
            hospitals across Karnataka and Maharashtra.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <Reveal>
          <h2 className="text-lg font-semibold text-slate-900">
            Why we exist
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Most businesses end up juggling one vendor for cameras, another
            for access control, a freelance electrician for cabling, and no
            one at all once the invoice is paid. We started Netrix to be the
            single team that surveys, quotes, installs and stays on the hook
            afterwards — through an AMC that actually gets used, not just
            sold.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            As an authorized ZKTeco channel partner, we pair genuine
            biometric and access-control hardware with our own installation
            and integration work, so attendance data lands correctly in your
            payroll system from day one — not as a separate project six
            months later.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {values.map(({ icon: Icon, title, body }, index) => (
            <Reveal key={title} delay={index * 70}>
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

        <Reveal className="mt-14 rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
          <h2 className="text-lg font-semibold text-slate-900">
            Talk to us about your site
          </h2>
          <p className="mt-1.5 text-sm text-slate-600">
            A short survey is the fastest way to get an accurate quotation.
          </p>
          <Link to="/request-quote" className="mt-5 inline-block">
            <Button size="lg">
              Request a Quote
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </Link>
        </Reveal>
      </section>

      <SiteFooter />
    </div>
  );
};

export default About;
