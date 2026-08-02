import { Routes, Route } from "react-router-dom";
import { TabBar } from "./components/TabBar";
import { Home } from "./screens/Home";
import { Trip } from "./screens/Trip";
import { Courses } from "./screens/Courses";
import { Cup } from "./screens/Cup";
import { ScoreEntry } from "./screens/ScoreEntry";
import { Players } from "./screens/Players";
import { Admin } from "./screens/Admin";

export function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/trip" element={<Trip />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/courses/:courseId" element={<Courses />} />
        <Route path="/cup" element={<Cup />} />
        <Route path="/score/:roundId" element={<ScoreEntry />} />
        <Route path="/me" element={<Players />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Home />} />
      </Routes>
      <TabBar />
    </div>
  );
}
