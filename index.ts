// This is a code file showcasing how to create Graphs and what they are in Langgraph

import { StateGraph, START, END, StateGraphArgs } from "@langchain/langgraph";


// State type
interface HelloWorldGraphState {
    name: string; // Add a name property
    isHuman: boolean; // Add an isHuman property
}

// State
const graphStateChannels: StateGraphArgs<HelloWorldGraphState>["channels"] = {
    name: {
        value: (prevName: string, newName: string) => newName,
        default: () => "Ada Lovelace",
    },
    isHuman: {
        value: (prevIsHuman: boolean, newIsHuman: boolean) =>
            newIsHuman ?? prevIsHuman ?? false,
    },
};

// A node that says hello
function sayHello(state: HelloWorldGraphState) {
    console.log(`Hello ${state.name}!`); // Change the name

    const newName = "Bill Nye";

    console.log(`Changing the name to '${newName}'`);

    return {
        name: newName,
    };
}

// A node that says bye
function sayBye(state: HelloWorldGraphState) {
    if (state.isHuman) {
        console.log(`Goodbye ${state.name}!`);
    } else {
        console.log(`Beep boop XC123-${state.name}!`);
    }
    return {};
}

//Initialise the LangGraph
const graphBuilder = new StateGraph({ channels: graphStateChannels }) // Add our nodes to the Graph
    .addNode("sayHello", sayHello)
    .addNode("sayBye", sayBye) // Add the edges between nodes
    .addEdge(START, "sayHello")
    .addEdge("sayHello", "sayBye")
    .addEdge("sayBye", END);

// Compile the Graph
export const helloWorldGraph = graphBuilder.compile();