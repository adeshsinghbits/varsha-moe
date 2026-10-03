import { motion } from "framer-motion";
import {
  FiActivity,
  FiWind,
  FiCloudLightning,
} from "react-icons/fi";
import { FaCloudRain, FaArrowRight, FaSatellite  } from "react-icons/fa";
import { LuMapPinned, LuBrainCircuit } from "react-icons/lu";
import { LuDroplets } from "react-icons/lu";
import { PiWaveSineBold } from "react-icons/pi";
import { useNavigate } from "react-router-dom";
import "../styles/Landing.css";
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

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      {/* Atmospheric background */}
      <div className="atmosphere">
        <div className="cloud cloud-one" />
        <div className="cloud cloud-two" />
        <div className="cloud cloud-three" />

        <div className="rain rain-one" />
        <div className="rain rain-two" />
        <div className="rain rain-three" />

        <div className="glow glow-one" />
        <div className="glow glow-two" />
      </div>

      {/* Navbar */}
      <nav className="landing-nav">
        <div className="brand">
          <div className="brand-icon">
            <FaCloudRain />
          </div>

          <div>
            <div className="brand-name">VARSHA</div>
            <div className="brand-subtitle">
              MONSOON FORECAST INTELLIGENCE
            </div>
          </div>
        </div>

        <div className="nav-links">
          <a href="#technology">Technology</a>
          <a href="#regimes">Regimes</a>
          <a href="#forecast">Forecast</a>
        </div>

        <button
          className="nav-button"
          onClick={() => navigate("/dashboard")}
        >
          Open Dashboard
          <FaArrowRight />
        </button>
      </nav>

      {/* Hero */}
      <main className="hero-section">
        <div className="hero-copy">
          <motion.div
            className="eyebrow"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="live-dot" />
            AI POST-PROCESSING · MODEL DEMONSTRATION
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            Regime-Aware AI for
            <br />
            <span>India's Monsoon Forecasts</span>
          </motion.h1>

          <motion.p
            className="hero-description"
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            Raw NWP rainfall forecasts are post-processed using atmospheric
            conditions, geographic features and monsoon regimes to produce
            improved district-level rainfall guidance.
          </motion.p>

          <motion.div
            className="hero-actions"
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <button
              className="primary-button"
              onClick={() => navigate("/dashboard")}
            >
              Explore Forecast
              <FaArrowRight />
            </button>

            <a href="#technology" className="secondary-button">
              View ML Pipeline
            </a>
          </motion.div>

          <motion.div
            className="hero-note"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
          >
            <FaSatellite />
            NWP + Atmospheric Signals + AI Post-Processing
          </motion.div>
        </div>

        <MonsoonGlobe />
      </main>

      {/* Stats */}
      <section className="stats-section">
        {stats.map((stat, index) => (
          <motion.div
            className="stat-card"
            key={stat.label}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
          >
            <div className="stat-icon">
              {stat.icon}
            </div>

            <div>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          </motion.div>
        ))}
      </section>

      {/* Technology */}
      <section id="technology" className="technology-section">
        <div className="section-heading">
          <div className="section-tag">
            <LuBrainCircuit />
            INTELLIGENCE LAYER
          </div>

          <h2>
            From raw forecast
            <br />
            <span>to rainfall intelligence.</span>
          </h2>

          <p>
            VARSHA-MoE understands the atmospheric regime before correcting
            rainfall forecasts, making the post-processing process
            regime-aware.
          </p>
        </div>

        <div className="pipeline">
          <PipelineCard
            icon={<FiWind />}
            number="01"
            title="NWP Forecast"
            description="Raw numerical weather prediction rainfall."
          />

          <div className="pipeline-arrow">→</div>

          <PipelineCard
            icon={<FiCloudLightning />}
            number="02"
            title="Regime Detection"
            description="AI identifies the prevailing monsoon regime."
          />

          <div className="pipeline-arrow">→</div>

          <PipelineCard
            icon={<LuBrainCircuit />}
            number="03"
            title="AI Correction"
            description="Rainfall bias is corrected using atmospheric context."
          />

          <div className="pipeline-arrow">→</div>

          <PipelineCard
            icon={<LuMapPinned />}
            number="04"
            title="District Product"
            description="Forecast intelligence delivered at district level."
          />
        </div>
      </section>

      {/* Regimes */}
      <section id="regimes" className="regime-section">
        <div className="section-heading centered">
          <div className="section-tag">
            <PiWaveSineBold />
            INDIAN MONSOON DYNAMICS
          </div>

          <h2>
            Every monsoon has
            <br />
            <span>a different story.</span>
          </h2>
        </div>

        <div className="regime-grid">
          {regimes.map((regime, index) => (
            <motion.div
              className="regime-pill"
              key={regime}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.07 }}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {regime}
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="forecast" className="cta-section">
        <div className="cta-card">
          <div className="cta-cloud">
            <FaCloudRain />
          </div>

          <div>
            <div className="section-tag">
              <FiActivity />
              MODEL DEMONSTRATION
            </div>

            <h2>
              See what the monsoon
              <br />
              <span>is telling us.</span>
            </h2>

            <p>
              Explore AI post-processed district rainfall, atmospheric
              regimes and verification metrics. Outputs are model
              demonstrations, not operational forecasts.
            </p>
          </div>

          <button
            className="primary-button"
            onClick={() => navigate("/dashboard")}
          >
            Launch VARSHA
            <FaArrowRight />
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        <div>
          <strong>VARSHA-MoE</strong>
          <span>Regime-Aware AI Post-Processing</span>
        </div>

        <span>
          Monsoon Intelligence for India
        </span>
      </footer>
    </div>
  );
}

function PipelineCard({
  icon,
  number,
  title,
  description,
}) {
  return (
    <motion.div
      className="pipeline-card"
      whileHover={{
        y: -8,
      }}
    >
      <div className="pipeline-number">{number}</div>

      <div className="pipeline-icon">
        {icon}
      </div>

      <h3>{title}</h3>

      <p>{description}</p>
    </motion.div>
  );
}