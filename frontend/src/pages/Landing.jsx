import { motion } from "framer-motion";
import {
  FiActivity,
  FiWind,
  FiCloudLightning,
} from "react-icons/fi";
import {
  FaCloudRain,
  FaArrowRight,
  FaSatellite,
} from "react-icons/fa";
import {
  LuMapPinned,
  LuBrainCircuit,
} from "react-icons/lu";
import { PiWaveSineBold } from "react-icons/pi";
import { useNavigate } from "react-router-dom";

import MonsoonGlobe from "../components/MonsoonGlobe";

const stats = [
  {
    value: "7",
    label: "Weather Regimes",
    icon: <FaCloudRain />,
  },
  {
    value: "NWP",
    label: "Rainfall Input",
    icon: <FiWind />,
  },
  {
    value: "AI",
    label: "Bias Correction",
    icon: <LuBrainCircuit />,
  },
  {
    value: "District",
    label: "Level Forecast",
    icon: <LuMapPinned />,
  },
];

const regimes = [
  "Active Monsoon",
  "Break Monsoon",
  "Low / Depression",
  "Coastal",
  "Orographic",
  "Western Disturbance",
  "Weak / Normal",
];

const fadeUp = {
  hidden: {
    opacity: 0,
    y: 30,
  },
  visible: {
    opacity: 1,
    y: 0,
  },
};

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020617] text-slate-50">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">

        {/* Background radial glows */}
        <div className="absolute right-[10%] top-0 h-125 w-125 rounded-full bg-cyan-400/10 blur-[100px]" />

        <div className="absolute bottom-[10%] left-[5%] h-125 w-125 rounded-full bg-emerald-500/10 blur-[100px]" />

        {/* Clouds */}
        <div className="absolute -left-30 top-22.5 h-37.5 w-105 rounded-[100px] bg-slate-800/55 opacity-45 blur-[25px]" />

        <div className="absolute -right-40 top-45 h-37.5] w-105 scale-[1.3] rounded-[100px] bg-slate-800/55 opacity-45 blur-[25px]" />

        <div className="absolute left-[35%] top-130 h-37.5 w-105 rounded-[100px] bg-slate-800/55 opacity-20 blur-[25px]" />

        {/* Rain */}
        <div className="absolute left-[15%] top-0 h-25 w-px rotate-15 animate-[rainDrop_2.5s_linear_infinite] bg-linear-to-b from-transparent to-sky-400/50" />

        <div className="absolute left-[55%] top-0 h-25 w-px rotate-15 animate-[rainDrop_2.5s_linear_infinite_1s] bg-linear-to-b from-transparent to-sky-400/50" />

        <div className="absolute right-[15%] top-0 h-25 w-px rotate-15 animate-[rainDrop_2.5s_linear_infinite_1.7s] bg-linear-to-b from-transparent to-sky-400/50" />
      </div>

      {/* =========================================================
          NAVBAR
      ========================================================= */}

      <nav className="relative z-20 mx-auto flex h-22.5 w-[92%] max-w-350 items-center justify-between border-b border-slate-400/10">

        {/* Brand */}
        <div className="flex items-center gap-3">

          <div>
            <div className="text-[20px] font-extrabold tracking-[0.08em]">
              VARSHA
            </div>

            <div className="text-[8px] tracking-[0.16em] text-slate-500">
              MONSOON FORECAST INTELLIGENCE
            </div>
          </div>

        </div>

        {/* Navigation */}
        <div className="hidden gap-8.5 lg:flex">

          <a
            href="#technology"
            className="text-sm text-slate-400 transition-colors duration-300 hover:text-cyan-400"
          >
            Technology
          </a>

          <a
            href="#regimes"
            className="text-sm text-slate-400 transition-colors duration-300 hover:text-cyan-400"
          >
            Regimes
          </a>

          <a
            href="#forecast"
            className="text-sm text-slate-400 transition-colors duration-300 hover:text-cyan-400"
          >
            Forecast
          </a>

        </div>

        {/* Dashboard button */}
        <button
          onClick={() => navigate("/dashboard")}
          className="flex cursor-pointer items-center gap-2 rounded-[10px] border-0 bg-linear-to-br from-cyan-600 to-cyan-800 px-4.5 py-2.75 text-sm font-medium text-white shadow-[0_10px_35px_rgba(6,182,212,0.2)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_15px_45px_rgba(6,182,212,0.3)]"
        >
          Open Dashboard
          <FaArrowRight className="text-xs" />
        </button>

      </nav>

      {/* =========================================================
          HERO
      ========================================================= */}

      <main className="relative z-10 mx-auto grid min-h-170 w-[92%] max-w-350 grid-cols-1 items-center gap-7.5 lg:grid-cols-[0.95fr_1.05fr]">

        {/* Hero content */}
        <div className="flex flex-col pt-12.5 lg:items-start items-center text-center lg:text-left">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-2 text-[11px] font-bold tracking-[0.16em] text-cyan-400"
          >
            <span className="h-1.75 w-1.75 rounded-full bg-emerald-400 shadow-[0_0_12px_#10b981]" />
            AI MONSOON INTELLIGENCE
          </motion.div>

          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.15, duration: 0.7 }}
            className="my-6.25 max-w-212.5 text-[48px] font-extrabold leading-[0.95] tracking-tighter sm:text-[60px] md:text-[70px] lg:text-[76px] xl:text-[88px]"
          >
            Regime-Aware AI for
            <br />

            <span className="bg-linear-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              India's Monsoon Forecasts
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.25, duration: 0.7 }}
            className="max-w-142.5 text-[15px] leading-[1.7] text-slate-400 sm:text-[17px] lg:text-[18px]"
          >
            Raw NWP rainfall forecasts are post-processed using atmospheric
            conditions, geographic features and monsoon regimes to produce
            improved district-level rainfall guidance.
          </motion.p>

          {/* Hero buttons */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.35, duration: 0.7 }}
            className="mt-7.5 flex w-full flex-col gap-3.5 sm:w-auto sm:flex-row"
          >

            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center justify-center gap-2 rounded-[10px] bg-linear-to-br from-cyan-600 to-cyan-800 px-5.5 py-3.75 text-[15px] font-bold text-white shadow-[0_10px_35px_rgba(6,182,212,0.2)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_15px_45px_rgba(6,182,212,0.3)]"
            >
              Explore Forecast
              <FaArrowRight />
            </button>

            <a
              href="#technology"
              className="flex items-center justify-center rounded-[10px] border border-slate-400/20 bg-slate-900/50 px-5.5 py-3.75 text-slate-300 backdrop-blur-sm transition-all duration-300 hover:border-cyan-400/40 hover:text-cyan-400"
            >
              View ML Pipeline
            </a>

          </motion.div>

          {/* Hero note */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.7 }}
            className="mt-8.75 flex items-center gap-2 text-xs text-slate-500"
          >
            <FaSatellite className="text-cyan-400" />
            NWP + Atmospheric Signals + AI Post-Processing
          </motion.div>

        </div>

        {/* Globe */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            delay: 0.3,
            duration: 0.8,
          }}
          className="relative flex h-125 items-center justify-center lg:h-145"
        >
          <MonsoonGlobe />
        </motion.div>

      </main>

      {/* =========================================================
          STATS
      ========================================================= */}

      <section className="relative z-10 mx-auto mb-25 mt-5 grid w-[92%] max-w-300 grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">

        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{
              opacity: 0,
              y: 30,
            }}
            whileInView={{
              opacity: 1,
              y: 0,
            }}
            viewport={{
              once: true,
            }}
            transition={{
              delay: index * 0.1,
              duration: 0.5,
            }}
            className="flex items-center gap-3.5 rounded-[15px] border border-slate-400/10 bg-slate-900/70 p-5.5 backdrop-blur-[15px]"
          >

            <div className="grid h-10.5 w-10.5 shrink-0 place-items-center rounded-[10px] bg-cyan-500/10 text-cyan-400">
              {stat.icon}
            </div>

            <div>
              <strong className="block text-xl">
                {stat.value}
              </strong>

              <span className="mt-0.75 block text-[11px] text-slate-500">
                {stat.label}
              </span>
            </div>

          </motion.div>
        ))}

      </section>

      {/* =========================================================
          TECHNOLOGY
      ========================================================= */}

      <section
        id="technology"
        className="relative z-10 mx-auto mb-32.5 w-[92%] max-w-300"
      >

        <div className="max-w-175">

          <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.16em] text-cyan-400">
            <LuBrainCircuit />
            INTELLIGENCE LAYER
          </div>

          <h2 className="mt-4.5 text-[38px] font-extrabold leading-none tracking-[-0.04em] sm:text-[50px] lg:text-[62px]">
            From raw forecast
            <br />

            <span className="bg-linear-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              to rainfall intelligence.
            </span>
          </h2>

          <p className="mt-4.5 text-base leading-[1.7] text-slate-400">
            VARSHA-MoE understands the atmospheric regime before correcting
            rainfall forecasts, making the post-processing process
            regime-aware.
          </p>

        </div>

        {/* Pipeline */}
        <div className="mt-13.75 grid grid-cols-1 items-center gap-3.75 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">

          <PipelineCard
            icon={<FiWind />}
            number="01"
            title="NWP Forecast"
            description="Raw numerical weather prediction rainfall."
          />

          <PipelineArrow />

          <PipelineCard
            icon={<FiCloudLightning />}
            number="02"
            title="Regime Detection"
            description="AI identifies the prevailing monsoon regime."
          />

          <PipelineArrow />

          <PipelineCard
            icon={<LuBrainCircuit />}
            number="03"
            title="AI Correction"
            description="Rainfall bias is corrected using atmospheric context."
          />

          <PipelineArrow />

          <PipelineCard
            icon={<LuMapPinned />}
            number="04"
            title="District Product"
            description="Forecast intelligence delivered at district level."
          />

        </div>

      </section>

      {/* =========================================================
          REGIMES
      ========================================================= */}

      <section
        id="regimes"
        className="relative z-10 mx-auto mb-32.5 w-[92%] max-w-300"
      >

        <div className="mx-auto max-w-175 text-center">

          <div className="flex items-center justify-center gap-2 text-[11px] font-bold tracking-[0.16em] text-cyan-400">
            <PiWaveSineBold />
            INDIAN MONSOON DYNAMICS
          </div>

          <h2 className="mt-4.5 text-[38px] font-extrabold leading-none tracking-[-0.04em] sm:text-[50px] lg:text-[62px]">
            Every monsoon has
            <br />

            <span className="bg-linear-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              a different story.
            </span>
          </h2>

        </div>

        <div className="mt-12.5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">

          {regimes.map((regime, index) => (
            <motion.div
              key={regime}
              initial={{
                opacity: 0,
                scale: 0.9,
              }}
              whileInView={{
                opacity: 1,
                scale: 1,
              }}
              viewport={{
                once: true,
              }}
              transition={{
                delay: index * 0.07,
                duration: 0.4,
              }}
              whileHover={{
                y: -4,
              }}
              className="flex min-h-22.5 items-center gap-3.5 rounded-[14px] border border-slate-400/10 bg-slate-900/70 p-5 text-[13px] text-slate-300 transition-all duration-300 hover:border-cyan-400/35 hover:text-cyan-400"
            >

              <span className="text-[11px] font-extrabold text-cyan-700">
                {String(index + 1).padStart(2, "0")}
              </span>

              {regime}

            </motion.div>
          ))}

        </div>

      </section>

      {/* =========================================================
          CTA
      ========================================================= */}

      <section
        id="forecast"
        className="relative z-10 mx-auto mb-32.5 w-[92%] max-w-300"
      >

        <div className="relative flex flex-col items-start justify-between gap-10 overflow-hidden rounded-[25px] border border-cyan-400/15 bg-[radial-gradient(circle_at_80%_30%,rgba(6,182,212,0.18),transparent_30%),linear-gradient(135deg,rgba(8,47,73,0.8),rgba(2,6,23,0.9))] p-7.5 sm:p-11.25 lg:flex-row lg:items-center lg:p-13.75">

          {/* Decorative cloud */}
          <div className="pointer-events-none absolute -right-7.5 -top-12.5 text-[150px] text-cyan-400/4 sm:right-30 sm:text-[180px]">
            <FaCloudRain />
          </div>

          <div className="relative z-10">

            <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.16em] text-cyan-400">
              <FiActivity />
              MODEL DEMONSTRATION
            </div>

            <h2 className="mt-4.5 text-[38px] font-extrabold leading-none tracking-[-0.04em] sm:text-[50px] lg:text-[62px]">
              See what the monsoon
              <br />

              <span className="bg-linear-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                is telling us.
              </span>
            </h2>

            <p className="mt-4.5 max-w-175 text-base leading-[1.7] text-slate-400">
              Explore AI post-processed district rainfall, atmospheric
              regimes and verification metrics. Outputs are model
              demonstrations, not operational forecasts.
            </p>

          </div>

          <button
            onClick={() => navigate("/dashboard")}
            className="relative z-10 flex shrink-0 items-center gap-2 rounded-[10px] bg-linear-to-br from-cyan-600 to-cyan-800 px-5.5 py-3.75 text-[15px] font-bold text-white shadow-[0_10px_35px_rgba(6,182,212,0.2)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_15px_45px_rgba(6,182,212,0.3)]"
          >
            Launch VARSHA
            <FaArrowRight />
          </button>

        </div>

      </section>

      {/* =========================================================
          FOOTER
      ========================================================= */}

      <footer className="relative z-10 mx-auto flex w-[92%] max-w-300 flex-col gap-3 border-t border-slate-400/10 py-8.75 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">

        <div>
          <strong className="mr-2.5 text-slate-400">
            VARSHA-MoE
          </strong>

          <span>
            Regime-Aware AI Post-Processing
          </span>
        </div>

        <span>
          Monsoon Intelligence for India
        </span>

      </footer>

    </div>
  );
}

/* =========================================================
   PIPELINE CARD
========================================================= */

function PipelineCard({
  icon,
  number,
  title,
  description,
}) {
  return (
    <motion.div
      whileHover={{
        y: -8,
      }}
      transition={{
        duration: 0.25,
      }}
      className="relative min-h-57.5 rounded-[18px] border border-slate-400/10 bg-linear-to-br from-slate-900/95 to-slate-950/75 p-6 transition-colors duration-300 hover:border-cyan-400/35"
    >

      <div className="absolute right-5 top-4.5 text-xs text-slate-700">
        {number}
      </div>

      <div className="grid h-12 w-12 place-items-center rounded-xl bg-cyan-500/10 text-[22px] text-cyan-400">
        {icon}
      </div>

      <h3 className="mt-4.5 text-[19px] font-bold">
        {title}
      </h3>

      <p className="mt-2 text-[13px] leading-[1.6] text-slate-500">
        {description}
      </p>

    </motion.div>
  );
}

/* =========================================================
   PIPELINE ARROW
========================================================= */

function PipelineArrow() {
  return (
    <div className="justify-self-center text-[28px] text-cyan-950 lg:rotate-0 rotate-90">
      →
    </div>
  );
}
