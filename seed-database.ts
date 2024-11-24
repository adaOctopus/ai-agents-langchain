import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { MongoClient } from "mongodb";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { z } from "zod";
import "dotenv/config";
import { Employee, parser } from "./schema/hrSchema";

// This is basically using AI to create dummy data in our MOngoDB collection
// WIth vectors and embeddings to be readable by the model
// And by using ATlas Search (next to COllections in mongodb ui)
// we created the search index vector_search
// WIth JSON_EDITOR
// {
//     "fields": [
//       {
//         "numDimensions": 1536,
//         "path": "embedding",
//         "similarity": "cosine",
//         "type": "vector"
//       }
//     ]
//   }


const client = new MongoClient(process.env.MONGODB_ATLAS_URI as string);


const llm = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0.7, //creativity level (0 strict, 1 super creative)
    apiKey: process.env.OPENAI_API_KEY as string,
});

async function generateSyntheticData(): Promise<Employee[]> {
    const prompt = `You are a helpful assistant that generates employee data. Generate 10 fictional employee records. Each record should include the following fields: employee_id, first_name, last_name, date_of_birth, address, contact_details, job_details, work_location, reporting_manager, skills, performance_reviews, benefits, emergency_contact, notes. Ensure variety in the data and realistic values.
  
    ${parser.getFormatInstructions()}`;

    console.log("Generating synthetic data...");

    const response = await llm.invoke(prompt);
    return parser.parse(response.content as string);
}

async function createEmployeeSummary(employee: Employee): Promise<string> {
    return new Promise((resolve) => {
        const jobDetails = `${employee.job_details.job_title} in ${employee.job_details.department}`;
        const skills = employee.skills.join(", ");
        const performanceReviews = employee.performance_reviews
            .map(
                (review) =>
                    `Rated ${review.rating} on ${review.review_date}: ${review.comments}`
            )
            .join(" ");
        const basicInfo = `${employee.first_name} ${employee.last_name}, born on ${employee.date_of_birth}`;
        const workLocation = `Works at ${employee.work_location.nearest_office}, Remote: ${employee.work_location.is_remote}`;
        const notes = employee.notes;

        const summary = `${basicInfo}. Job: ${jobDetails}. Skills: ${skills}. Reviews: ${performanceReviews}. Location: ${workLocation}. Notes: ${notes}`;

        resolve(summary);
    });
}

//Last Seed Database function that does all the AI part

async function seedDatabase(): Promise<void> {
    try {
        await client.connect();
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        const db = client.db("hr_database");
        const collection = db.collection("employees");

        await collection.deleteMany({});

        const syntheticData = await generateSyntheticData();

        // creates a more summarized version of the data, and saves it to the database
        const recordsWithSummaries = await Promise.all(
            syntheticData.map(async (record) => ({
                pageContent: await createEmployeeSummary(record),
                metadata: { ...record },
            }))
        );

        // Creates the embeddings and vectors
        for (const record of recordsWithSummaries) {
            await MongoDBAtlasVectorSearch.fromDocuments(
                [record],
                new OpenAIEmbeddings(),
                {
                    collection,
                    indexName: "vector_index",
                    textKey: "embedding_text",
                    embeddingKey: "embedding",
                }
            );

            console.log("Successfully processed & saved record:", record.metadata.employee_id);
        }

        console.log("Database seeding completed");

    } catch (error) {
        console.error("Error seeding database:", error);
    } finally {
        await client.close();
    }
}

seedDatabase().catch(console.error);
