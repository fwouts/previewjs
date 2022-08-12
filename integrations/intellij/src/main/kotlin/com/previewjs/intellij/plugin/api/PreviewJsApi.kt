package com.previewjs.intellij.plugin.api

import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import java.util.concurrent.TimeUnit

fun api(baseUrl: String): PreviewJsApi {
    val moshi = Moshi.Builder()
        .addLast(KotlinJsonAdapterFactory())
        .build()
    val okHttpClient: OkHttpClient = OkHttpClient().newBuilder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .writeTimeout(10, TimeUnit.SECONDS)
        .build()
    val retrofit = Retrofit.Builder()
        .baseUrl(baseUrl)
        .client(okHttpClient)
        .addConverterFactory(MoshiConverterFactory.create(moshi))
        .build()

    return retrofit.create(PreviewJsApi::class.java)
}

interface PreviewJsApi {
    @GET("/health")
    suspend fun checkHealth(): CheckHealthResponse

    @POST("/workspaces/get")
    suspend fun getWorkspace(@Body req: GetWorkspaceRequest): GetWorkspaceResponse

    @POST("/workspaces/dispose")
    suspend fun disposeWorkspace(@Body req: DisposeWorkspaceRequest): DisposeWorkspaceResponse

    @POST("/analyze/file")
    suspend fun analyzeFile(@Body req: AnalyzeFileRequest): AnalyzeFileResponse

    @POST("/previews/start")
    suspend fun startPreview(@Body req: StartPreviewRequest): StartPreviewResponse

    @POST("/previews/stop")
    suspend fun stopPreview(@Body req: StopPreviewRequest): StopPreviewResponse

    @POST("/pending-files/update")
    suspend fun updatePendingFile(@Body req: UpdatePendingFileRequest): UpdatePendingFileResponse
}

data class CheckHealthResponse(
    val ready: Boolean
)

data class GetWorkspaceRequest(
    val absoluteFilePath: String
)

data class GetWorkspaceResponse(
    val workspaceId: String?
)

data class DisposeWorkspaceRequest(
    val workspaceId: String
)

class DisposeWorkspaceResponse

data class AnalyzeFileRequest(
    val workspaceId: String,
    val absoluteFilePath: String,
    val options: AnalyzeFileOptions? = null
)

data class AnalyzeFileOptions(
    val offset: Int?
)

data class AnalyzeFileResponse(
    val components: List<AnalyzedFileComponent>
)

data class AnalyzedFileComponent(
    val componentName: String,
    val offset: Int,
    val componentId: String,
)

data class StartPreviewRequest(
    val workspaceId: String,
)

data class StartPreviewResponse(
    val url: String
)

data class StopPreviewRequest(
    val workspaceId: String
)

class StopPreviewResponse

data class UpdatePendingFileRequest(
    val absoluteFilePath: String,
    val utf8Content: String?
)

class UpdatePendingFileResponse
