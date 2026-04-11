import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export function App() {
  const [name, setName] = useState("");
  const [greeting, setGreeting] = useState("");

  async function greet() {
    const result = await invoke<string>("greet", { name });
    setGreeting(result);
  }

  return (
    <main className="container">
      <h1>DevMesh</h1>
      <p>Cross-device environment browser. Tauri + React working.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button type="submit">Greet</button>
      </form>
      {greeting && <p>{greeting}</p>}
    </main>
  );
}
